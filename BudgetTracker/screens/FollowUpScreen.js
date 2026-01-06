import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const EXPENSE_LOG_KEY = '@expense_log';
const SWIPE_STATS_KEY = '@swipe_stats';

const CATEGORIES = [
  { id: 'bills', name: 'Bills', icon: '📄', color: '#3498DB' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#F39C12' },
  { id: 'selfcare', name: 'Self Care', icon: '✨', color: '#FF6B9D' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#9B59B6' },
  { id: 'food', name: 'Food', icon: '🍽️', color: '#4ECDC4' },
];

const formatDate = (date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const SWIPE_THRESHOLD = 120;

export default function FollowUpScreen({ navigation }) {
  const [followUps, setFollowUps] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingCard, setCurrentProcessingCard] = useState(null);
  const [splitItems, setSplitItems] = useState([]);
  const [swipeStats, setSwipeStats] = useState({ left: 0, right: 0, byCategory: {} });
  const [allDone, setAllDone] = useState(false);
  
  // Use ref to always have access to latest followUps in panResponder
  const followUpsRef = useRef(followUps);
  useEffect(() => {
    followUpsRef.current = followUps;
  }, [followUps]);
  
  // Animation values
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-15deg', '0deg', '15deg'],
    extrapolate: 'clamp',
  });
  const processOpacity = position.x.interpolate({
    inputRange: [0, width / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const skipOpacity = position.x.interpolate({
    inputRange: [-width / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Swipe handlers that use refs to avoid stale closure
  const handleSwipeRight = () => {
    const currentFollowUps = followUpsRef.current;
    if (currentFollowUps.length === 0) return;
    const currentCard = { ...currentFollowUps[0] };
    
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      startProcessing(currentCard);
    });
  };

  const handleSwipeLeft = () => {
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      // Move first card to end of array
      setFollowUps(prev => {
        if (prev.length <= 1) return prev;
        const [first, ...rest] = prev;
        return [...rest, first];
      });
    });
  };

  const handleResetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          handleSwipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          handleSwipeLeft();
        } else {
          handleResetPosition();
        }
      },
    })
  ).current;

  useEffect(() => {
    loadFollowUps();
    loadSwipeStats();
  }, []);

  const loadFollowUps = async () => {
    try {
      const logData = await AsyncStorage.getItem(EXPENSE_LOG_KEY);
      if (logData) {
        const { log } = JSON.parse(logData);
        const pending = (log || []).filter(
          entry => entry.categoryId === 'followup' && !entry.processed
        );
        console.log('Loaded follow-ups:', pending.length);
        setFollowUps(pending);
        if (pending.length === 0) {
          setAllDone(true);
        }
      }
    } catch (error) {
      console.log('Error loading follow-ups:', error);
    }
  };

  const loadSwipeStats = async () => {
    try {
      const statsData = await AsyncStorage.getItem(SWIPE_STATS_KEY);
      if (statsData) {
        setSwipeStats(JSON.parse(statsData));
      }
    } catch (error) {
      console.log('Error loading swipe stats:', error);
    }
  };

  const saveSwipeStats = async (stats) => {
    try {
      await AsyncStorage.setItem(SWIPE_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.log('Error saving swipe stats:', error);
    }
  };

  // Start processing (split & categorize)
  const startProcessing = (card) => {
    if (!card || card.amount === undefined) {
      console.log('startProcessing called with invalid card:', card);
      return;
    }
    setCurrentProcessingCard(card);
    setIsProcessing(true);
    setSplitItems([
      {
        id: '1',
        description: 'Item 1',
        amount: card.amount.toString(),
        categoryId: 'shopping',
      }
    ]);
  };

  const addSplitItem = () => {
    setSplitItems([...splitItems, {
      id: Date.now().toString(),
      description: `Item ${splitItems.length + 1}`,
      amount: '0',
      categoryId: 'shopping',
    }]);
  };

  const updateSplitItem = (id, field, value) => {
    setSplitItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeSplitItem = (id) => {
    if (splitItems.length > 1) {
      setSplitItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const getTotalSplit = () => {
    return splitItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const confirmSplit = async () => {
    if (!currentProcessingCard) return;
    
    const expense = currentProcessingCard;
    const totalSplit = getTotalSplit();
    
    if (Math.abs(totalSplit - expense.amount) > 0.01) {
      Alert.alert(
        'Amount Mismatch',
        `Split total ($${totalSplit.toFixed(2)}) doesn't match original amount ($${expense.amount.toFixed(2)}). Please adjust.`
      );
      return;
    }

    try {
      const logData = await AsyncStorage.getItem(EXPENSE_LOG_KEY);
      let log = [];
      if (logData) {
        log = JSON.parse(logData).log || [];
      }

      // Add new split expenses
      for (const item of splitItems) {
        const newExpense = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          amount: parseFloat(item.amount),
          categoryId: item.categoryId,
          date: expense.date,
          timestamp: Date.now(),
          description: item.description,
          splitFromFollowUp: expense.id,
        };
        log.unshift(newExpense);
      }

      // Mark original follow-up as processed
      log = log.map(entry => 
        entry.id === expense.id 
          ? { ...entry, processed: true, splitInto: splitItems.length, splitItems: [...splitItems] }
          : entry
      );

      await AsyncStorage.setItem(EXPENSE_LOG_KEY, JSON.stringify({ log }));

      // Update swipe stats (count as "processed" = good)
      const newStats = { ...swipeStats };
      newStats.right = (newStats.right || 0) + 1;
      splitItems.forEach(item => {
        if (!newStats.byCategory) newStats.byCategory = {};
        if (!newStats.byCategory[item.categoryId]) {
          newStats.byCategory[item.categoryId] = { count: 0, total: 0 };
        }
        newStats.byCategory[item.categoryId].count += 1;
        newStats.byCategory[item.categoryId].total += parseFloat(item.amount) || 0;
      });
      setSwipeStats(newStats);
      saveSwipeStats(newStats);

      // Remove processed card from list
      setFollowUps(prev => prev.filter(fu => fu.id !== expense.id));
      
      // Reset processing state
      setIsProcessing(false);
      setCurrentProcessingCard(null);
      setSplitItems([]);

      // Check if all done
      if (followUps.length <= 1) {
        setAllDone(true);
      }

    } catch (error) {
      console.log('Error saving split:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  const cancelProcessing = () => {
    // Put the card back at the front
    setIsProcessing(false);
    setCurrentProcessingCard(null);
    setSplitItems([]);
  };

  // Render the stack of cards
  const renderCardStack = () => {
    if (followUps.length === 0) return null;

    const currentCard = followUps[0];

    return (
      <View style={styles.cardStackContainer}>
        {/* Background cards for stack effect */}
        {followUps.slice(1, 4).map((card, idx) => (
          <View 
            key={card.id} 
            style={[
              styles.stackCard,
              { 
                top: 10 + (idx + 1) * 8,
                transform: [{ scale: 1 - (idx + 1) * 0.05 }],
                opacity: 1 - (idx + 1) * 0.2,
              }
            ]}
          >
            <LinearGradient
              colors={['#1E1E2E', '#2D2D44']}
              style={styles.stackCardGradient}
            >
              <Text style={styles.stackCardAmount}>${card.amount.toFixed(2)}</Text>
            </LinearGradient>
          </View>
        ))}

        {/* Active card */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.activeCard,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate: rotate },
              ],
            },
          ]}
        >
          {/* Swipe indicators */}
          <Animated.View style={[styles.swipeIndicator, styles.processIndicator, { opacity: processOpacity }]}>
            <Text style={styles.swipeIndicatorText}>✓ Process</Text>
          </Animated.View>
          <Animated.View style={[styles.swipeIndicator, styles.skipIndicator, { opacity: skipOpacity }]}>
            <Text style={styles.swipeIndicatorText}>↩ Skip</Text>
          </Animated.View>

          <LinearGradient
            colors={['#1E1E2E', '#2D2D44']}
            style={styles.cardGradient}
          >
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatDate(new Date(currentCard.date))}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Pending</Text>
              </View>
            </View>

            {/* Amount */}
            <Text style={styles.cardAmount}>${currentCard.amount.toFixed(2)}</Text>

            {/* Receipt preview if available */}
            {currentCard.attachment && currentCard.attachment.type === 'image' && (
              <Image source={{ uri: currentCard.attachment.uri }} style={styles.receiptThumb} />
            )}
            {currentCard.attachment && currentCard.attachment.type === 'pdf' && (
              <View style={styles.pdfBadge}>
                <Text style={styles.pdfBadgeText}>📄 PDF Receipt</Text>
              </View>
            )}
            {!currentCard.attachment && (
              <View style={styles.noReceiptBadge}>
                <Text style={styles.noReceiptText}>No receipt attached</Text>
              </View>
            )}

            {/* Swipe hints */}
            <View style={styles.swipeHints}>
              <View style={styles.swipeHint}>
                <Text style={styles.swipeHintIcon}>← Skip</Text>
                <Text style={styles.swipeHintText}>Move to back</Text>
              </View>
              <View style={styles.swipeHint}>
                <Text style={styles.swipeHintIcon}>Process →</Text>
                <Text style={styles.swipeHintText}>Split & categorize</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Card counter */}
        <View style={styles.cardCounter}>
          <Text style={styles.cardCounterText}>
            {followUps.length} card{followUps.length !== 1 ? 's' : ''} remaining
          </Text>
        </View>

        {/* Tap to process button (alternative to swipe) */}
        {currentCard && (
          <TouchableOpacity 
            style={styles.tapToProcessBtn}
            onPress={() => startProcessing({ ...currentCard })}
          >
            <Text style={styles.tapToProcessText}>Tap to Process</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render processing view
  const renderProcessingView = () => {
    if (!currentProcessingCard) return null;
    const expense = currentProcessingCard;

    return (
      <ScrollView style={styles.processingContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.processingCard}>
          {/* Receipt Preview */}
          {expense.attachment && expense.attachment.type === 'image' && (
            <Image source={{ uri: expense.attachment.uri }} style={styles.receiptImage} />
          )}
          {expense.attachment && expense.attachment.type === 'pdf' && (
            <View style={styles.pdfPlaceholder}>
              <Text style={styles.pdfIcon}>📄</Text>
              <Text style={styles.pdfText}>{expense.attachment.name}</Text>
            </View>
          )}

          <View style={styles.processingHeader}>
            <Text style={styles.processingTitle}>Split & Categorize</Text>
            <Text style={styles.processingAmount}>Total: ${expense.amount.toFixed(2)}</Text>
          </View>

          {/* Split Items */}
          {splitItems.map((item, index) => (
            <View key={item.id} style={styles.splitItem}>
              <View style={styles.splitItemHeader}>
                <TextInput
                  style={styles.splitDescription}
                  value={item.description}
                  onChangeText={(text) => updateSplitItem(item.id, 'description', text)}
                  placeholder="Item description"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                {splitItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeSplitItem(item.id)}>
                    <Text style={styles.removeItemBtn}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.splitItemRow}>
                <View style={styles.splitAmountContainer}>
                  <Text style={styles.splitDollar}>$</Text>
                  <TextInput
                    style={styles.splitAmountInput}
                    value={item.amount}
                    onChangeText={(text) => updateSplitItem(item.id, 'amount', text.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
              </View>
              
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.miniCategoryBtn,
                      item.categoryId === cat.id && { backgroundColor: cat.color }
                    ]}
                    onPress={() => updateSplitItem(item.id, 'categoryId', cat.id)}
                  >
                    <Text style={[
                      styles.miniCategoryText,
                      item.categoryId === cat.id && styles.miniCategoryTextSelected
                    ]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addItemBtn} onPress={addSplitItem}>
            <Text style={styles.addItemText}>+ Add Item</Text>
          </TouchableOpacity>

          {/* Split Summary */}
          <View style={styles.splitTotalRow}>
            <Text style={styles.splitTotalLabel}>Split Total:</Text>
            <Text style={[
              styles.splitTotalValue,
              Math.abs(getTotalSplit() - expense.amount) > 0.01 
                ? { color: '#E74C3C' } 
                : { color: '#4ECDC4' }
            ]}>
              ${getTotalSplit().toFixed(2)}
            </Text>
          </View>

          {Math.abs(getTotalSplit() - expense.amount) > 0.01 && (
            <Text style={styles.mismatchWarning}>
              {getTotalSplit() < expense.amount 
                ? `$${(expense.amount - getTotalSplit()).toFixed(2)} remaining to allocate`
                : `$${(getTotalSplit() - expense.amount).toFixed(2)} over the original amount`
              }
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.processingActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelProcessing}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                Math.abs(getTotalSplit() - expense.amount) > 0.01 && styles.confirmBtnDisabled
              ]}
              onPress={confirmSplit}
              disabled={Math.abs(getTotalSplit() - expense.amount) > 0.01}
            >
              <Text style={styles.confirmBtnText}>Confirm Split</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  // Render all done view
  const renderAllDoneView = () => (
    <View style={styles.allDoneContainer}>
      <Text style={styles.allDoneIcon}>🎉</Text>
      <Text style={styles.allDoneTitle}>All Done!</Text>
      <Text style={styles.allDoneSubtitle}>You've processed all follow-up expenses</Text>
      
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Session Summary</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={styles.statValue}>{swipeStats.right || 0}</Text>
            <Text style={styles.statLabel}>Processed</Text>
          </View>
        </View>
        
        {/* Category breakdown */}
        {swipeStats.byCategory && Object.keys(swipeStats.byCategory).length > 0 && (
          <View style={styles.categoryStats}>
            <Text style={styles.categoryStatsTitle}>By Category</Text>
            {Object.entries(swipeStats.byCategory).map(([catId, stats]) => {
              const cat = CATEGORIES.find(c => c.id === catId);
              if (!cat) return null;
              return (
                <View key={catId} style={styles.categoryStatRow}>
                  <Text style={styles.categoryStatIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryStatName}>{cat.name}</Text>
                  <Text style={styles.categoryStatNums}>
                    {stats.count} item{stats.count !== 1 ? 's' : ''} · ${(stats.total || 0).toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={styles.doneBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.doneBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );

  // Empty state
  if (followUps.length === 0 && !allDone) {
    return (
      <LinearGradient colors={['#0F0F1A', '#1A1A2E', '#16213E']} style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No Follow-ups</Text>
          <Text style={styles.emptySubtitle}>You don't have any expenses to process</Text>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F0F1A', '#1A1A2E', '#16213E']} style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Follow-ups</Text>
        <Text style={styles.headerCount}>
          {allDone ? 'Done!' : `${followUps.length} left`}
        </Text>
      </View>

      {/* Main Content */}
      {allDone ? (
        renderAllDoneView()
      ) : isProcessing ? (
        renderProcessingView()
      ) : (
        renderCardStack()
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 15,
  },
  backText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  
  // Card Stack
  cardStackContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  stackCard: {
    position: 'absolute',
    width: width - 40,
    height: height * 0.5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  stackCardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackCardAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  activeCard: {
    width: width - 40,
    height: height * 0.5,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  cardGradient: {
    flex: 1,
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(231, 76, 60, 0.3)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E74C3C',
  },
  cardAmount: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginVertical: 24,
  },
  receiptThumb: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 16,
  },
  pdfBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  pdfBadgeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  noReceiptBadge: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  noReceiptText: {
    fontSize: 14,
    color: 'rgba(231, 76, 60, 0.8)',
  },
  swipeHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 20,
  },
  swipeHint: {
    alignItems: 'center',
  },
  swipeHintIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  swipeHintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  swipeIndicator: {
    position: 'absolute',
    top: 50,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  processIndicator: {
    right: 20,
    backgroundColor: '#4ECDC4',
  },
  skipIndicator: {
    left: 20,
    backgroundColor: '#F39C12',
  },
  swipeIndicatorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardCounter: {
    marginTop: 20,
  },
  cardCounterText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  tapToProcessBtn: {
    marginTop: 20,
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  tapToProcessText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Processing View
  processingContainer: {
    flex: 1,
    padding: 20,
  },
  processingCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  receiptImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 20,
  },
  pdfPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  pdfIcon: {
    fontSize: 40,
  },
  pdfText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  processingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  processingAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E74C3C',
  },
  splitItem: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  splitItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  splitDescription: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  removeItemBtn: {
    color: '#E74C3C',
    fontSize: 18,
    fontWeight: '700',
    paddingLeft: 10,
  },
  splitItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  splitDollar: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
  },
  splitAmountInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    width: 70,
    paddingVertical: 8,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  miniCategoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  miniCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  miniCategoryTextSelected: {
    color: '#FFFFFF',
  },
  addItemBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addItemText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  splitTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  splitTotalLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  splitTotalValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  mismatchWarning: {
    fontSize: 13,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 16,
  },
  processingActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    marginRight: 12,
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 30,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backBtnText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
  },

  // All Done View
  allDoneContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDoneIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  allDoneTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  allDoneSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 30,
  },
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    marginBottom: 24,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  categoryStats: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  categoryStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  categoryStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryStatIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  categoryStatName: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  categoryStatNums: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  doneBtn: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 14,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
