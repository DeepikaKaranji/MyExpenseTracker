import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'bills', name: 'Bills', icon: '📄', color: '#3498DB' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#F39C12' },
  { id: 'selfcare', name: 'Self Care', icon: '✨', color: '#FF6B9D' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#9B59B6' },
  { id: 'food', name: 'Food', icon: '🍽️', color: '#4ECDC4' },
];

const STORAGE_KEY = '@budget_data';

export default function MonthlyBudgetAlloc({ navigation }) {
  const [totalBudget, setTotalBudget] = useState('');
  const [allocations, setAllocations] = useState(
    CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: '' }), {})
  );
  const [inputModes, setInputModes] = useState(
    CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: 'percent' }), {})
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveData();
    }
  }, [totalBudget, allocations, inputModes, isLoading]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const { budget, allocs, modes } = JSON.parse(savedData);
        setTotalBudget(budget || '');
        setAllocations(allocs || CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: '' }), {}));
        setInputModes(modes || CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: 'percent' }), {}));
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ budget: totalBudget, allocs: allocations, modes: inputModes })
      );
    } catch (error) {
      console.log('Error saving data:', error);
    }
  };

  const budgetNumber = parseFloat(totalBudget) || 0;

  const getPercentageValue = (categoryId) => {
    const value = parseFloat(allocations[categoryId]) || 0;
    if (inputModes[categoryId] === 'dollar' && budgetNumber > 0) {
      return (value / budgetNumber) * 100;
    }
    return value;
  };

  const getTotalPercentage = (excludeCategoryId = null) => {
    return CATEGORIES.reduce((sum, cat) => {
      if (cat.id === excludeCategoryId) return sum;
      return sum + getPercentageValue(cat.id);
    }, 0);
  };

  const totalPercentage = getTotalPercentage();

  const toggleInputMode = (categoryId) => {
    const currentMode = inputModes[categoryId];
    const currentValue = parseFloat(allocations[categoryId]) || 0;
    
    let newValue = '';
    if (currentMode === 'percent' && budgetNumber > 0) {
      newValue = ((currentValue / 100) * budgetNumber).toFixed(2);
    } else if (currentMode === 'dollar' && budgetNumber > 0) {
      newValue = ((currentValue / budgetNumber) * 100).toFixed(1);
    }
    
    setInputModes(prev => ({
      ...prev,
      [categoryId]: currentMode === 'percent' ? 'dollar' : 'percent',
    }));
    
    setAllocations(prev => ({
      ...prev,
      [categoryId]: newValue,
    }));
  };

  const handleAllocationChange = useCallback((categoryId, value) => {
    if (value === '') {
      setAllocations(prev => ({
        ...prev,
        [categoryId]: '',
      }));
      return;
    }

    const cleanValue = value.replace(/[^0-9.]/g, '');
    const numValue = parseFloat(cleanValue) || 0;
    
    let percentValue = numValue;
    if (inputModes[categoryId] === 'dollar' && budgetNumber > 0) {
      percentValue = (numValue / budgetNumber) * 100;
    }
    
    const otherCategoriesTotal = getTotalPercentage(categoryId);
    const newTotal = otherCategoriesTotal + percentValue;
    
    if (newTotal > 100.01) {
      const maxAllowedPercent = Math.max(0, 100 - otherCategoriesTotal);
      let maxAllowedValue = maxAllowedPercent;
      
      if (inputModes[categoryId] === 'dollar' && budgetNumber > 0) {
        maxAllowedValue = (maxAllowedPercent / 100) * budgetNumber;
      }
      
      Alert.alert(
        'Limit Reached',
        `Maximum you can allocate here is ${inputModes[categoryId] === 'dollar' ? '$' + maxAllowedValue.toFixed(2) : maxAllowedPercent.toFixed(0) + '%'} (total cannot exceed 100%)`,
        [{ text: 'OK' }]
      );
      
      setAllocations(prev => ({
        ...prev,
        [categoryId]: maxAllowedValue > 0 ? maxAllowedValue.toFixed(inputModes[categoryId] === 'dollar' ? 2 : 0) : '',
      }));
      return;
    }
    
    setAllocations(prev => ({
      ...prev,
      [categoryId]: cleanValue,
    }));
  }, [allocations, inputModes, budgetNumber]);

  const calculateDollarValue = (categoryId) => {
    const pct = getPercentageValue(categoryId);
    return ((pct / 100) * budgetNumber).toFixed(2);
  };

  const calculatePercentValue = (categoryId) => {
    return getPercentageValue(categoryId).toFixed(1);
  };

  const resetAllocations = () => {
    setAllocations(CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: '' }), {}));
    setInputModes(CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: 'percent' }), {}));
  };

  const distributeEvenly = () => {
    const evenPercentage = Math.floor(100 / CATEGORIES.length);
    const remainder = 100 - (evenPercentage * CATEGORIES.length);
    
    const newAllocations = {};
    const newModes = {};
    CATEGORIES.forEach((cat, index) => {
      newAllocations[cat.id] = (evenPercentage + (index === 0 ? remainder : 0)).toString();
      newModes[cat.id] = 'percent';
    });
    setAllocations(newAllocations);
    setInputModes(newModes);
  };

  const getRemainingPercentage = () => {
    return Math.max(0, 100 - totalPercentage);
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#0F0F1A', '#1A1A2E', '#16213E']} style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F0F1A', '#1A1A2E', '#16213E']} style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Monthly Budget</Text>
            <Text style={styles.headerSubtitle}>Set your allocation</Text>
          </View>

          {/* Total Budget Input */}
          <View style={styles.budgetCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              style={styles.budgetCardGradient}
            >
              <Text style={styles.budgetLabel}>Monthly Budget</Text>
              <View style={styles.budgetInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.budgetInput}
                  value={totalBudget}
                  onChangeText={setTotalBudget}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
              
              <View style={styles.percentageStatusContainer}>
                <View style={styles.percentageBarBg}>
                  <View 
                    style={[
                      styles.percentageBarFill, 
                      { 
                        width: `${Math.min(totalPercentage, 100)}%`,
                        backgroundColor: totalPercentage >= 99.9 && totalPercentage <= 100.1 ? '#4ECDC4' : 
                                        totalPercentage > 100.1 ? '#E74C3C' : '#F39C12'
                      }
                    ]} 
                  />
                </View>
                <View style={styles.percentageTextRow}>
                  <Text style={[
                    styles.percentageText,
                    totalPercentage >= 99.9 && totalPercentage <= 100.1 ? styles.percentageComplete : 
                    totalPercentage > 100.1 ? styles.percentageOver : null
                  ]}>
                    {totalPercentage.toFixed(1)}% allocated
                  </Text>
                  {totalPercentage >= 99.9 && totalPercentage <= 100.1 && (
                    <Text style={styles.checkmark}>✓ Complete</Text>
                  )}
                  {totalPercentage < 99.9 && (
                    <Text style={styles.remainingText}>
                      {getRemainingPercentage().toFixed(1)}% remaining
                    </Text>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={distributeEvenly}>
              <Text style={styles.actionButtonText}>Distribute Evenly</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.resetButton]} onPress={resetAllocations}>
              <Text style={styles.actionButtonText}>Reset All</Text>
            </TouchableOpacity>
          </View>

          {/* Categories */}
          <View style={styles.categoriesContainer}>
            <Text style={styles.sectionTitle}>Categories</Text>
            
            {CATEGORIES.map((category) => {
              const isPercentMode = inputModes[category.id] === 'percent';
              const dollarValue = calculateDollarValue(category.id);
              const percentValue = calculatePercentValue(category.id);
              
              return (
                <View key={category.id} style={styles.categoryCard}>
                  <LinearGradient
                    colors={[`${category.color}20`, `${category.color}10`]}
                    style={styles.categoryCardGradient}
                  >
                    <View style={styles.categoryRow}>
                      <View style={styles.categoryInfo}>
                        <Text style={styles.categoryIcon}>{category.icon}</Text>
                        <View style={styles.categoryNameContainer}>
                          <Text style={styles.categoryName}>{category.name}</Text>
                          <Text style={styles.categorySecondary}>
                            {isPercentMode ? `$${dollarValue}` : `${percentValue}%`}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.inputWithToggle}>
                        <TouchableOpacity 
                          style={[styles.toggleButton, { borderColor: category.color }]}
                          onPress={() => toggleInputMode(category.id)}
                        >
                          <Text style={[
                            styles.toggleButtonText, 
                            isPercentMode ? styles.toggleActive : null,
                            { color: isPercentMode ? category.color : 'rgba(255,255,255,0.4)' }
                          ]}>%</Text>
                          <View style={[styles.toggleDivider, { backgroundColor: category.color }]} />
                          <Text style={[
                            styles.toggleButtonText,
                            !isPercentMode ? styles.toggleActive : null,
                            { color: !isPercentMode ? category.color : 'rgba(255,255,255,0.4)' }
                          ]}>$</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.inputContainer}>
                          {!isPercentMode && <Text style={styles.inputPrefix}>$</Text>}
                          <TextInput
                            style={[styles.valueInput, { borderColor: category.color }]}
                            value={allocations[category.id]}
                            onChangeText={(value) => handleAllocationChange(category.id, value)}
                            placeholder="0"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            keyboardType="numeric"
                            returnKeyType="done"
                            maxLength={isPercentMode ? 5 : 10}
                          />
                          {isPercentMode && <Text style={[styles.inputSuffix, { color: category.color }]}>%</Text>}
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.progressBarBg}>
                      <View 
                        style={[
                          styles.progressBar, 
                          { 
                            width: `${Math.min(getPercentageValue(category.id), 100)}%`,
                            backgroundColor: category.color 
                          }
                        ]} 
                      />
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
              style={styles.summaryGradient}
            >
              <Text style={styles.summaryTitle}>Summary</Text>
              {CATEGORIES.map((category) => (
                <View key={category.id} style={styles.summaryRow}>
                  <View style={styles.summaryLeft}>
                    <View style={[styles.summaryDot, { backgroundColor: category.color }]} />
                    <Text style={styles.summaryLabel}>{category.name}</Text>
                  </View>
                  <View style={styles.summaryRight}>
                    <Text style={[styles.summaryPercent, { color: category.color }]}>
                      {calculatePercentValue(category.id)}%
                    </Text>
                    <Text style={styles.summaryValue}>
                      ${calculateDollarValue(category.id)}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total Allocated</Text>
                <View style={styles.summaryRight}>
                  <Text style={[
                    styles.summaryTotalPercent,
                    totalPercentage >= 99.9 && totalPercentage <= 100.1 ? { color: '#4ECDC4' } : { color: '#F39C12' }
                  ]}>
                    {totalPercentage.toFixed(1)}%
                  </Text>
                  <Text style={styles.summaryTotalValue}>
                    ${((totalPercentage / 100) * budgetNumber).toFixed(2)}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Data saves automatically</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    fontWeight: '400',
  },
  budgetCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  budgetCardGradient: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  budgetLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  budgetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 42,
    fontWeight: '300',
    color: '#4ECDC4',
    marginRight: 4,
  },
  budgetInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    padding: 0,
  },
  percentageStatusContainer: {
    marginTop: 20,
  },
  percentageBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  percentageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  percentageText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  percentageComplete: {
    color: '#4ECDC4',
  },
  percentageOver: {
    color: '#E74C3C',
  },
  checkmark: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  remainingText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  resetButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  categoryCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryCardGradient: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  categoryNameContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categorySecondary: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  inputWithToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  toggleActive: {
    fontWeight: '800',
  },
  toggleDivider: {
    width: 1,
    height: 16,
    opacity: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginRight: 2,
  },
  valueInput: {
    width: 70,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  inputSuffix: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  summaryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  summaryGradient: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryPercent: {
    fontSize: 14,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
  },
  summaryValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  summaryTotalLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryTotalPercent: {
    fontSize: 16,
    fontWeight: '700',
    width: 50,
    textAlign: 'right',
  },
  summaryTotalValue: {
    fontSize: 16,
    color: '#4ECDC4',
    fontWeight: '700',
    width: 80,
    textAlign: 'right',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
});

