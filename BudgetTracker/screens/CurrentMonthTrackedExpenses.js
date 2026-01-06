import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'bills', name: 'Bills', icon: '📄', color: '#3498DB' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#F39C12' },
  { id: 'selfcare', name: 'Self Care', icon: '✨', color: '#FF6B9D' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#9B59B6' },
  { id: 'food', name: 'Food', icon: '🍽️', color: '#4ECDC4' },
  { id: 'followup', name: 'Follow-up', icon: '🚩', color: '#E74C3C' },
];

const BUDGET_STORAGE_KEY = '@budget_data';
const EXPENSES_STORAGE_KEY = '@expenses_data';

const getCurrentMonth = () => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  return months[now.getMonth()];
};

// Custom Pie Chart Component
const PieChart = ({ data, totalBudget, onSlicePress }) => {
  const size = width - 80;
  const center = size / 2;
  const radius = size / 2 - 20;
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) {
    return (
      <View style={[styles.pieContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="rgba(255,255,255,0.1)"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius - 40}
            fill="#1A1A2E"
          />
        </Svg>
        <View style={styles.pieCenterText}>
          <Text style={styles.pieCenterLabel}>No Expenses</Text>
          <Text style={styles.pieCenterAmount}>$0.00</Text>
        </View>
      </View>
    );
  }

  let startAngle = -90;
  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const endAngle = startAngle + angle;
    
    // Calculate path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathData = `
      M ${center} ${center}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      Z
    `;
    
    const slice = {
      ...item,
      pathData,
      percentage,
      startAngle,
      endAngle,
    };
    
    startAngle = endAngle;
    return slice;
  });

  return (
    <View style={[styles.pieContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G>
          {slices.map((slice, index) => (
            <Path
              key={slice.id}
              d={slice.pathData}
              fill={slice.color}
              onPress={() => onSlicePress(slice)}
            />
          ))}
          {/* Center hole */}
          <Circle
            cx={center}
            cy={center}
            r={radius - 50}
            fill="#1A1A2E"
          />
        </G>
      </Svg>
      <View style={styles.pieCenterText}>
        <Text style={styles.pieCenterLabel}>Total Spent</Text>
        <Text style={styles.pieCenterAmount}>${total.toFixed(2)}</Text>
        {totalBudget > 0 && (
          <Text style={styles.pieCenterBudget}>
            of ${totalBudget.toFixed(2)}
          </Text>
        )}
      </View>
    </View>
  );
};

export default function CurrentMonthTrackedExpenses({ navigation }) {
  const [expenses, setExpenses] = useState(
    CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: '' }), {})
  );
  const [totalBudget, setTotalBudget] = useState(0);
  const [allocations, setAllocations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlice, setSelectedSlice] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveExpenses();
    }
  }, [expenses, isLoading]);

  const loadData = async () => {
    try {
      // Load budget data
      const budgetData = await AsyncStorage.getItem(BUDGET_STORAGE_KEY);
      if (budgetData) {
        const { budget, allocs } = JSON.parse(budgetData);
        setTotalBudget(parseFloat(budget) || 0);
        setAllocations(allocs || {});
      }

      // Load expenses data
      const expensesData = await AsyncStorage.getItem(EXPENSES_STORAGE_KEY);
      if (expensesData) {
        const { expenses: savedExpenses } = JSON.parse(expensesData);
        setExpenses(savedExpenses || CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: '' }), {}));
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveExpenses = async () => {
    try {
      await AsyncStorage.setItem(
        EXPENSES_STORAGE_KEY,
        JSON.stringify({ expenses })
      );
    } catch (error) {
      console.log('Error saving expenses:', error);
    }
  };

  const handleExpenseChange = (categoryId, value) => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setExpenses(prev => ({
      ...prev,
      [categoryId]: cleanValue,
    }));
  };

  const getTotalExpenses = () => {
    return Object.values(expenses).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  const getBudgetForCategory = (categoryId) => {
    const allocation = parseFloat(allocations[categoryId]) || 0;
    return (allocation / 100) * totalBudget;
  };

  const getSpentPercentageForCategory = (categoryId) => {
    const budget = getBudgetForCategory(categoryId);
    const spent = parseFloat(expenses[categoryId]) || 0;
    if (budget === 0) return 0;
    return (spent / budget) * 100;
  };

  // Exclude follow-up from pie chart
  const pieData = CATEGORIES
    .filter(cat => cat.id !== 'followup')
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      value: parseFloat(expenses[cat.id]) || 0,
      budget: getBudgetForCategory(cat.id),
    })).filter(item => item.value > 0);

  const handleSlicePress = (slice) => {
    setSelectedSlice(slice);
    setShowModal(true);
  };

  const totalExpenses = getTotalExpenses();
  const remainingBudget = totalBudget - totalExpenses;
  const spentPercentage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

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
            <Text style={styles.headerTitle}>{getCurrentMonth()} Expenses</Text>
            <Text style={styles.headerSubtitle}>Track your spending</Text>
          </View>

          {/* Pie Chart */}
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Spending Overview</Text>
            <Text style={styles.chartHint}>Tap a slice to see details</Text>
            <PieChart 
              data={pieData} 
              totalBudget={totalBudget}
              onSlicePress={handleSlicePress} 
            />
            
            {/* Legend - exclude follow-up */}
            <View style={styles.legend}>
              {CATEGORIES.filter(cat => cat.id !== 'followup').map(cat => {
                const spent = parseFloat(expenses[cat.id]) || 0;
                if (spent === 0) return null;
                const percentage = totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0;
                return (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={styles.legendItem}
                    onPress={() => handleSlicePress({
                      ...cat,
                      value: spent,
                      budget: getBudgetForCategory(cat.id),
                      percentage,
                    })}
                  >
                    <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.legendText}>{cat.name}</Text>
                    <Text style={[styles.legendPercent, { color: cat.color }]}>
                      {percentage.toFixed(1)}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Budget Status */}
          <View style={styles.statusCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
              style={styles.statusGradient}
            >
              <View style={styles.statusRow}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Budget</Text>
                  <Text style={styles.statusValue}>${totalBudget.toFixed(2)}</Text>
                </View>
                <View style={styles.statusDivider} />
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Spent</Text>
                  <Text style={[styles.statusValue, { color: '#E74C3C' }]}>
                    ${totalExpenses.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.statusDivider} />
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Left</Text>
                  <Text style={[styles.statusValue, { color: remainingBudget >= 0 ? '#4ECDC4' : '#E74C3C' }]}>
                    ${remainingBudget.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${Math.min(spentPercentage, 100)}%`,
                      backgroundColor: spentPercentage > 80 ? '#E74C3C' : 
                                      spentPercentage > 50 ? '#F39C12' : '#4ECDC4'
                    }
                  ]} 
                />
              </View>
            </LinearGradient>
          </View>

          {/* Expense Inputs - exclude follow-up */}
          <View style={styles.expensesContainer}>
            <Text style={styles.sectionTitle}>Enter Expenses</Text>
            
            {CATEGORIES.filter(cat => cat.id !== 'followup').map((category) => {
              const budgetForCat = getBudgetForCategory(category.id);
              const spentInCat = parseFloat(expenses[category.id]) || 0;
              const percentSpent = getSpentPercentageForCategory(category.id);
              const isOverBudget = spentInCat > budgetForCat && budgetForCat > 0;
              
              return (
                <View key={category.id} style={styles.expenseCard}>
                  <LinearGradient
                    colors={[`${category.color}15`, `${category.color}08`]}
                    style={styles.expenseCardGradient}
                  >
                    <View style={styles.expenseRow}>
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseIcon}>{category.icon}</Text>
                        <View style={styles.expenseNameContainer}>
                          <Text style={styles.expenseName}>{category.name}</Text>
                          <Text style={styles.expenseBudget}>
                            Budget: ${budgetForCat.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.expenseInputContainer}>
                        <Text style={styles.dollarPrefix}>$</Text>
                        <TextInput
                          style={[
                            styles.expenseInput, 
                            { borderColor: isOverBudget ? '#E74C3C' : category.color }
                          ]}
                          value={expenses[category.id]}
                          onChangeText={(value) => handleExpenseChange(category.id, value)}
                          placeholder="0.00"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="numeric"
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                    
                    {/* Progress bar */}
                    <View style={styles.categoryProgressBg}>
                      <View 
                        style={[
                          styles.categoryProgressFill, 
                          { 
                            width: `${Math.min(percentSpent, 100)}%`,
                            backgroundColor: isOverBudget ? '#E74C3C' : category.color 
                          }
                        ]} 
                      />
                    </View>
                    {isOverBudget && (
                      <Text style={styles.overBudgetText}>
                        ⚠️ Over budget by ${(spentInCat - budgetForCat).toFixed(2)}
                      </Text>
                    )}
                  </LinearGradient>
                </View>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Data saves automatically</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal for slice details */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalContent}>
            {selectedSlice && (
              <>
                <Text style={styles.modalIcon}>{selectedSlice.icon}</Text>
                <Text style={styles.modalTitle}>{selectedSlice.name}</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Spent</Text>
                  <Text style={[styles.modalValue, { color: selectedSlice.color }]}>
                    ${selectedSlice.value.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Budget</Text>
                  <Text style={styles.modalValue}>
                    ${selectedSlice.budget.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>% of Total Expenses</Text>
                  <Text style={[styles.modalValue, { color: selectedSlice.color }]}>
                    {selectedSlice.percentage.toFixed(1)}%
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: selectedSlice.color }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
    color: '#9B59B6',
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
  chartSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  chartHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  pieContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pieCenterText: {
    position: 'absolute',
    alignItems: 'center',
  },
  pieCenterLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pieCenterAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  pieCenterBudget: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  legend: {
    width: '100%',
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  legendText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  legendPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  statusGradient: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  expensesContainer: {
    marginBottom: 20,
  },
  expenseCard: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  expenseCardGradient: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  expenseNameContainer: {
    flex: 1,
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  expenseBudget: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  expenseInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollarPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginRight: 4,
  },
  expenseInput: {
    width: 90,
    height: 42,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  categoryProgressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  overBudgetText: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 8,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 28,
    width: width - 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

