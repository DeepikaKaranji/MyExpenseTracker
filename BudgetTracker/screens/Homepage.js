import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Keyboard,
  Modal,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const { width } = Dimensions.get('window');

const BUDGET_STORAGE_KEY = '@budget_data';
const EXPENSES_STORAGE_KEY = '@expenses_data';
const EXPENSE_LOG_KEY = '@expense_log';

const CATEGORIES = [
  { id: 'bills', name: 'Bills', icon: '📄', color: '#3498DB' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#F39C12' },
  { id: 'selfcare', name: 'Self Care', icon: '✨', color: '#FF6B9D' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#9B59B6' },
  { id: 'food', name: 'Food', icon: '🍽️', color: '#4ECDC4' },
  { id: 'followup', name: 'Follow-up', icon: '🚩', color: '#E74C3C' },
];

const getCurrentMonth = () => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  return {
    name: months[now.getMonth()],
    year: now.getFullYear(),
    short: months[now.getMonth()].substring(0, 3).toUpperCase(),
  };
};

const formatDate = (date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const formatTime = (date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

export default function Homepage({ navigation }) {
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState({});
  const [allocations, setAllocations] = useState({});
  
  // Quick expense entry state
  const [expenseAmount, setExpenseAmount] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [attachment, setAttachment] = useState(null); // { uri, type: 'image' | 'pdf', name }
  const [pendingFollowUps, setPendingFollowUps] = useState(0);
  const [followUpTotal, setFollowUpTotal] = useState(0);
  
  // Date/Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Month/Year filter state
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [tempMonth, setTempMonth] = useState(new Date().getMonth());
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  
  // Ref for amount input
  const amountInputRef = useRef(null);
  
  const currentMonth = getCurrentMonth();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  // Reload data when filter changes
  useEffect(() => {
    loadData();
  }, [filterMonth, filterYear]);

  const loadData = async () => {
    try {
      // Load budget data
      const budgetData = await AsyncStorage.getItem(BUDGET_STORAGE_KEY);
      if (budgetData) {
        const { budget, allocs } = JSON.parse(budgetData);
        setTotalBudget(parseFloat(budget) || 0);
        setAllocations(allocs || {});
      }

      // Load expense log (source of truth)
      const logData = await AsyncStorage.getItem(EXPENSE_LOG_KEY);
      let log = [];
      if (logData) {
        const parsed = JSON.parse(logData);
        log = parsed.log || [];
      }

      // Calculate expenses by category from the log
      const expensesByCat = {};
      let total = 0;
      const filteredExpenses = [];
      
      // Filter expenses by selected month/year
      log.forEach(entry => {
        const entryDate = new Date(entry.date);
        // Use local time methods for consistent comparison
        const entryMonth = entryDate.getMonth();
        const entryYear = entryDate.getFullYear();
        
        console.log(`Entry: ${entry.date}, Month: ${entryMonth}, Year: ${entryYear}, Filter: ${filterMonth}/${filterYear}`);
        
        // Only count expenses from selected month
        if (entryMonth === filterMonth && entryYear === filterYear) {
          const catId = entry.categoryId;
          const amount = parseFloat(entry.amount) || 0;
          expensesByCat[catId] = (parseFloat(expensesByCat[catId]) || 0) + amount;
          total += amount;
          filteredExpenses.push(entry);
        }
      });
      
      console.log(`Total for ${filterMonth}/${filterYear}: ${total}, Entries: ${filteredExpenses.length}`);
      
      // Show recent expenses only from the filtered month
      setRecentExpenses(filteredExpenses.slice(0, 5));
      
      setExpensesByCategory(expensesByCat);
      setTotalExpenses(total);
      
      // Count pending follow-ups and calculate total amount (unprocessed follow-up expenses)
      const pendingFollowUpEntries = log.filter(
        entry => entry.categoryId === 'followup' && !entry.processed
      );
      setPendingFollowUps(pendingFollowUpEntries.length);
      
      // Calculate total amount flagged for follow-up
      const totalFollowUp = pendingFollowUpEntries.reduce(
        (sum, entry) => sum + (parseFloat(entry.amount) || 0), 0
      );
      setFollowUpTotal(totalFollowUp);
      
      // Also update the expenses storage to keep it in sync
      await AsyncStorage.setItem(
        EXPENSES_STORAGE_KEY,
        JSON.stringify({ expenses: Object.fromEntries(
          Object.entries(expensesByCat).map(([k, v]) => [k, v.toString()])
        )})
      );
      
    } catch (error) {
      console.log('Error loading data:', error);
    }
  };

  const saveExpense = async () => {
    const amount = parseFloat(expenseAmount);
    console.log('saveExpense called - amount:', amount, 'category:', selectedCategory, 'attachment:', attachment);
    
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Select Category', 'Please select a category for this expense.');
      return;
    }

    // Warning for Follow-up without receipt (optional but recommended)
    if (selectedCategory === 'followup' && !attachment) {
      Alert.alert(
        '📎 No Receipt Attached',
        'For best results, attach a receipt to help split and categorize this expense later.',
        [
          { text: 'Attach Receipt', onPress: () => showAttachmentOptions() },
          { text: 'Continue Anyway', onPress: () => proceedWithSave(), style: 'default' },
        ]
      );
      return;
    }

    await proceedWithSave();
  };

  const proceedWithSave = async () => {
    const amount = parseFloat(expenseAmount);

    try {
      // Create log entry with attachment if present
      const logEntry = {
        id: Date.now().toString(),
        amount,
        categoryId: selectedCategory,
        date: selectedDate.toISOString(),
        timestamp: Date.now(),
        attachment: attachment ? {
          uri: attachment.uri,
          type: attachment.type,
          name: attachment.name,
        } : null,
      };

      // Load and update expense log
      const logData = await AsyncStorage.getItem(EXPENSE_LOG_KEY);
      let log = [];
      if (logData) {
        const parsed = JSON.parse(logData);
        log = parsed.log || [];
      }
      log.unshift(logEntry);
      
      // Keep only last 100 entries
      if (log.length > 100) log = log.slice(0, 100);
      
      await AsyncStorage.setItem(
        EXPENSE_LOG_KEY,
        JSON.stringify({ log })
      );

      // Get category info before resetting
      const category = CATEGORIES.find(c => c.id === selectedCategory);
      const savedAmount = amount;
      
      // Reset form FIRST before showing alert
      setExpenseAmount('');
      setSelectedCategory(null);
      setSelectedDate(new Date());
      setAttachment(null);
      
      // Recalculate totals from the full log (source of truth)
      // Use the expense date's month/year for filtering
      const expenseDate = new Date(logEntry.date);
      const expenseMonth = expenseDate.getMonth();
      const expenseYear = expenseDate.getFullYear();
      
      // If the expense is for the currently viewed month, update totals
      // Otherwise, just reload data for the current filter
      if (expenseMonth === filterMonth && expenseYear === filterYear) {
        const expensesByCat = {};
        let newTotal = 0;
        const filteredExpenses = [];
        
        log.forEach(entry => {
          const entryDate = new Date(entry.date);
          if (entryDate.getMonth() === filterMonth && entryDate.getFullYear() === filterYear) {
            const catId = entry.categoryId;
            const amt = parseFloat(entry.amount) || 0;
            expensesByCat[catId] = (parseFloat(expensesByCat[catId]) || 0) + amt;
            newTotal += amt;
            filteredExpenses.push(entry);
          }
        });
        
        // Update state with recalculated data
        setExpensesByCategory(expensesByCat);
        setTotalExpenses(newTotal);
        setRecentExpenses(filteredExpenses.slice(0, 5));
      } else {
        // Expense is for a different month, just update recent for that month
        // But keep current view unchanged, just show confirmation
        console.log(`Expense logged for ${expenseMonth}/${expenseYear}, current view: ${filterMonth}/${filterYear}`);
      }
      
      // Always update follow-up counts (regardless of month filter)
      const pendingFollowUpEntries = log.filter(
        entry => entry.categoryId === 'followup' && !entry.processed
      );
      setPendingFollowUps(pendingFollowUpEntries.length);
      const totalFollowUp = pendingFollowUpEntries.reduce(
        (sum, entry) => sum + (parseFloat(entry.amount) || 0), 0
      );
      setFollowUpTotal(totalFollowUp);
      
      // Dismiss keyboard
      Keyboard.dismiss();
      
      // Show feedback after a small delay to allow state to update
      setTimeout(() => {
        Alert.alert(
          '✓ Expense Saved',
          `$${savedAmount.toFixed(2)} added to ${category.name}`,
          [{ text: 'OK' }],
          { cancelable: true }
        );
      }, 100);

    } catch (error) {
      console.log('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense. Please try again.');
    }
  };

  const getSpentPercentage = () => {
    if (totalBudget === 0) return 0;
    return Math.min((totalExpenses / totalBudget) * 100, 100);
  };

  const getRemainingBudget = () => {
    return totalBudget - totalExpenses;
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      // Preserve the time from selectedDate
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const onTimeChange = (event, time) => {
    setShowTimePicker(false);
    if (time) {
      // Preserve the date from selectedDate
      const newDate = new Date(selectedDate);
      newDate.setHours(time.getHours());
      newDate.setMinutes(time.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const isToday = () => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  };

  const isFormValid = () => {
    const amount = parseFloat(expenseAmount);
    return amount > 0 && selectedCategory !== null;
  };

  const getSelectedCategoryData = () => {
    return CATEGORIES.find(c => c.id === selectedCategory);
  };

  // Pick image from gallery or camera
  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Copy to app's document directory for persistence
      const fileName = `expense_${Date.now()}.jpg`;
      const destPath = `${FileSystem.documentDirectory}attachments/${fileName}`;
      
      // Create directory if it doesn't exist
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}attachments/`, { intermediates: true }).catch(() => {});
      
      await FileSystem.copyAsync({
        from: asset.uri,
        to: destPath,
      });

      setAttachment({
        uri: destPath,
        type: 'image',
        name: fileName,
      });
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = `expense_${Date.now()}.jpg`;
      const destPath = `${FileSystem.documentDirectory}attachments/${fileName}`;
      
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}attachments/`, { intermediates: true }).catch(() => {});
      
      await FileSystem.copyAsync({
        from: asset.uri,
        to: destPath,
      });

      setAttachment({
        uri: destPath,
        type: 'image',
        name: fileName,
      });
    }
  };

  // Pick PDF document
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = `expense_${Date.now()}.pdf`;
        const destPath = `${FileSystem.documentDirectory}attachments/${fileName}`;
        
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}attachments/`, { intermediates: true }).catch(() => {});
        
        await FileSystem.copyAsync({
          from: asset.uri,
          to: destPath,
        });

        setAttachment({
          uri: destPath,
          type: 'pdf',
          name: asset.name || fileName,
        });
      }
    } catch (error) {
      console.log('Document picker error:', error);
    }
  };

  // State for web attachment modal
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  
  // Show attachment options
  const showAttachmentOptions = () => {
    if (Platform.OS === 'web') {
      // Use modal for web since Alert doesn't support callbacks
      setShowAttachmentModal(true);
    } else {
      Alert.alert(
        'Attach Receipt',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Gallery', onPress: pickImage },
          { text: 'Select PDF', onPress: pickDocument },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  // Remove attachment
  const removeAttachment = () => {
    setAttachment(null);
  };

  return (
    <LinearGradient colors={['#0F0F1A', '#1A1A2E', '#16213E']} style={styles.container}>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Budget Tracker</Text>
          <TouchableOpacity 
            style={styles.monthBadge}
            onPress={() => {
              setTempMonth(filterMonth);
              setTempYear(filterYear);
              setShowMonthPicker(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.monthBadgeText}>
              {MONTHS[filterMonth].substring(0, 3).toUpperCase()} {filterYear} ▼
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mini Cards Row */}
        <View style={styles.miniCardsRow}>
          {/* Card 1: Monthly Budget - Mini */}
          <TouchableOpacity 
            style={styles.miniCard}
            onPress={() => navigation.navigate('MonthlyBudgetAlloc')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(78, 205, 196, 0.25)', 'rgba(78, 205, 196, 0.1)']}
              style={styles.miniCardGradient}
            >
              <View style={styles.miniCardHeader}>
                <Text style={styles.miniCardIcon}>💰</Text>
              </View>
              <Text style={styles.miniCardLabel}>Budget</Text>
              <Text style={styles.miniCardValue}>${totalBudget.toFixed(0)}</Text>
              <View style={styles.tapToEditRow}>
                <Text style={styles.tapToEdit}>Edit Allocation →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Card 2: Expenses - Mini */}
          <TouchableOpacity 
            style={styles.miniCard}
            onPress={() => navigation.navigate('CurrentMonthTrackedExpenses')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(155, 89, 182, 0.25)', 'rgba(155, 89, 182, 0.1)']}
              style={styles.miniCardGradient}
            >
              <View style={styles.miniCardHeader}>
                <Text style={styles.miniCardIcon}>📊</Text>
              </View>
              <Text style={styles.miniCardLabel}>Spent</Text>
              <Text style={[styles.miniCardValue, { color: '#E74C3C' }]}>
                ${totalExpenses.toFixed(0)}
              </Text>
              <View style={styles.tapToEditRow}>
                <Text style={[styles.tapToEdit, { color: '#9B59B6' }]}>View Chart →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Remaining Budget Banner */}
        <View style={styles.remainingBanner}>
          <Text style={styles.remainingLabel}>
            Remaining in {MONTHS[filterMonth]}
          </Text>
          <Text style={[
            styles.remainingValue,
            { color: getRemainingBudget() >= 0 ? '#4ECDC4' : '#E74C3C' }
          ]}>
            ${getRemainingBudget().toFixed(2)}
          </Text>
        </View>

        {/* Follow-up Banner - Always visible */}
        <TouchableOpacity 
          style={[
            styles.followUpBanner,
            pendingFollowUps === 0 && styles.followUpBannerEmpty
          ]}
          onPress={() => navigation.navigate('FollowUpScreen')}
          activeOpacity={0.8}
        >
          <View style={styles.followUpLeft}>
            <Text style={styles.followUpIcon}>🚩</Text>
            <View>
              <Text style={styles.followUpTitle}>
                {pendingFollowUps > 0 
                  ? `$${followUpTotal.toFixed(2)} flagged for follow-up`
                  : 'No pending follow-ups'
                }
              </Text>
              <Text style={styles.followUpSubtitle}>
                {pendingFollowUps > 0 
                  ? `${pendingFollowUps} expense${pendingFollowUps > 1 ? 's' : ''} to split & categorize`
                  : 'All caught up! 🎉'
                }
              </Text>
            </View>
          </View>
          <Text style={styles.followUpArrow}>→</Text>
        </TouchableOpacity>
        
        {/* Show indicator if viewing past/future month */}
        {(filterMonth !== new Date().getMonth() || filterYear !== new Date().getFullYear()) && (
          <View style={styles.viewingOtherMonth}>
            <Text style={styles.viewingOtherMonthText}>
              📅 Viewing {MONTHS[filterMonth]} {filterYear}
            </Text>
            <TouchableOpacity onPress={() => {
              setFilterMonth(new Date().getMonth());
              setFilterYear(new Date().getFullYear());
            }}>
              <Text style={styles.viewingOtherMonthLink}>Go to current month →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MAIN SECTION: Quick Expense Entry */}
        <View style={styles.quickExpenseSection}>
          <Text style={styles.sectionTitle}>Log Expense</Text>
          
          {/* Amount Input */}
          <View style={styles.amountInputContainer}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              ref={amountInputRef}
              style={styles.amountInput}
              value={expenseAmount}
              onChangeText={(text) => setExpenseAmount(text)}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus={true}
              editable={true}
            />
          </View>

          {/* Date & Time Selectors */}
          <View style={styles.dateTimeRow}>
            {/* Date Picker Button */}
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateTimeIcon}>📅</Text>
              <View style={styles.dateTimeTextContainer}>
                <Text style={styles.dateTimeLabel}>Date</Text>
                <Text style={styles.dateTimeValue}>{formatDate(selectedDate)}</Text>
              </View>
              {isToday() && <Text style={styles.todayBadge}>Today</Text>}
            </TouchableOpacity>

            {/* Time Picker Button */}
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.dateTimeIcon}>🕐</Text>
              <View style={styles.dateTimeTextContainer}>
                <Text style={styles.dateTimeLabel}>Time</Text>
                <Text style={styles.dateTimeValue}>{formatTime(selectedDate)}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Category Buttons */}
          <Text style={styles.categoryPrompt}>Select a category:</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    isSelected && styles.categoryButtonSelected,
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={isSelected 
                      ? [`${category.color}90`, `${category.color}70`]
                      : [`${category.color}30`, `${category.color}15`]
                    }
                    style={[
                      styles.categoryButtonGradient,
                      isSelected && { borderColor: category.color, borderWidth: 2 }
                    ]}
                  >
                    <Text style={styles.categoryButtonIcon}>{category.icon}</Text>
                    <Text style={[
                      styles.categoryButtonName,
                      isSelected && styles.categoryButtonNameSelected
                    ]}>{category.name}</Text>
                    {isSelected && (
                      <View style={[styles.selectedCheckmark, { backgroundColor: category.color }]}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Attachment Section */}
          <View style={styles.attachmentSection}>
            {!attachment ? (
              <TouchableOpacity 
                style={styles.attachButton}
                onPress={showAttachmentOptions}
              >
                <Text style={styles.attachButtonIcon}>📎</Text>
                <Text style={styles.attachButtonText}>Attach Receipt (optional)</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.attachmentPreview}>
                {attachment.type === 'image' ? (
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                ) : (
                  <View style={styles.pdfPreview}>
                    <Text style={styles.pdfIcon}>📄</Text>
                    <Text style={styles.pdfName} numberOfLines={1}>{attachment.name}</Text>
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.removeAttachmentBtn}
                  onPress={removeAttachment}
                >
                  <Text style={styles.removeAttachmentText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.changeAttachmentBtn}
                  onPress={showAttachmentOptions}
                >
                  <Text style={styles.changeAttachmentText}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !isFormValid() && styles.submitButtonDisabled
            ]}
            onPress={saveExpense}
            disabled={!isFormValid()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isFormValid() 
                ? ['#4ECDC4', '#45B7AA']
                : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
              }
              style={styles.submitButtonGradient}
            >
              <Text style={[
                styles.submitButtonText,
                !isFormValid() && styles.submitButtonTextDisabled
              ]}>
                {isFormValid() 
                  ? `Submit $${parseFloat(expenseAmount).toFixed(2)} → ${getSelectedCategoryData()?.name}`
                  : 'Enter amount & select category'
                }
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Recent Expenses */}
        {recentExpenses.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent</Text>
            {recentExpenses.map((expense) => {
              const category = CATEGORIES.find(c => c.id === expense.categoryId);
              const expenseDate = new Date(expense.date);
              return (
                <View key={expense.id} style={styles.recentItem}>
                  <Text style={styles.recentIcon}>{category?.icon}</Text>
                  <View style={styles.recentInfo}>
                    <View style={styles.recentCategoryRow}>
                      <Text style={styles.recentCategory}>{category?.name}</Text>
                      {expense.attachment && (
                        <Text style={styles.attachmentIndicator}>
                          {expense.attachment.type === 'image' ? '🖼️' : '📄'}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.recentDate}>
                      {formatDate(expenseDate)} • {formatTime(expenseDate)}
                    </Text>
                  </View>
                  <Text style={[styles.recentAmount, { color: category?.color }]}>
                    -${expense.amount.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Category Spending Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>This Month by Category</Text>
          {CATEGORIES.filter(cat => cat.id !== 'followup').map((cat) => {
            const spent = parseFloat(expensesByCategory[cat.id]) || 0;
            const allocated = (parseFloat(allocations[cat.id]) || 0) / 100 * totalBudget;
            
            return (
              <View key={cat.id} style={styles.summaryItem}>
                <View style={styles.summaryItemLeft}>
                  <Text style={styles.summaryIcon}>{cat.icon}</Text>
                  <Text style={styles.summaryName}>{cat.name}</Text>
                </View>
                <View style={styles.summaryItemRight}>
                  <Text style={[styles.summarySpent, { color: cat.color }]}>
                    ${spent.toFixed(0)}
                  </Text>
                  <Text style={styles.summaryBudget}>/ ${allocated.toFixed(0)}</Text>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          themeVariant="dark"
        />
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
          themeVariant="dark"
        />
      )}

      {/* Month/Year Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={styles.monthPickerModal}>
            <Text style={styles.monthPickerTitle}>Select Month & Year</Text>
            
            {/* Year Selector */}
            <View style={styles.yearSelector}>
              <TouchableOpacity 
                style={styles.yearArrowButton}
                onPress={() => setTempYear(prev => prev - 1)}
              >
                <Text style={styles.yearArrowText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{tempYear}</Text>
              <TouchableOpacity 
                style={styles.yearArrowButton}
                onPress={() => setTempYear(prev => prev + 1)}
              >
                <Text style={styles.yearArrowText}>▶</Text>
              </TouchableOpacity>
            </View>
            
            {/* Month Grid */}
            <View style={styles.monthGrid}>
              {MONTHS.map((month, index) => {
                const isSelected = tempMonth === index;
                const isCurrentMonth = index === new Date().getMonth() && tempYear === new Date().getFullYear();
                return (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.monthGridItem,
                      isSelected && styles.monthGridItemSelected,
                    ]}
                    onPress={() => setTempMonth(index)}
                  >
                    <Text style={[
                      styles.monthGridText,
                      isSelected && styles.monthGridTextSelected,
                      isCurrentMonth && !isSelected && styles.monthGridTextCurrent,
                    ]}>
                      {month.substring(0, 3)}
                    </Text>
                    {isCurrentMonth && (
                      <View style={[styles.currentDot, isSelected && { backgroundColor: '#fff' }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Action Buttons */}
            <View style={styles.monthPickerActions}>
              <TouchableOpacity 
                style={styles.monthPickerCancelBtn}
                onPress={() => setShowMonthPicker(false)}
              >
                <Text style={styles.monthPickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.monthPickerApplyBtn}
                onPress={() => {
                  setFilterMonth(tempMonth);
                  setFilterYear(tempYear);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={styles.monthPickerApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
            
            {/* Quick Actions */}
            <TouchableOpacity 
              style={styles.goToTodayBtn}
              onPress={() => {
                const now = new Date();
                setTempMonth(now.getMonth());
                setTempYear(now.getFullYear());
              }}
            >
              <Text style={styles.goToTodayText}>Go to Current Month</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Web Attachment Options Modal */}
      <Modal
        visible={showAttachmentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAttachmentModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentModal(false)}
        >
          <View style={styles.attachmentModalContent}>
            <Text style={styles.attachmentModalTitle}>📎 Attach Receipt</Text>
            <Text style={styles.attachmentModalSubtitle}>Choose an option</Text>
            
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={() => {
                setShowAttachmentModal(false);
                takePhoto();
              }}
            >
              <Text style={styles.attachmentOptionIcon}>📷</Text>
              <Text style={styles.attachmentOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={() => {
                setShowAttachmentModal(false);
                pickImage();
              }}
            >
              <Text style={styles.attachmentOptionIcon}>🖼️</Text>
              <Text style={styles.attachmentOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={() => {
                setShowAttachmentModal(false);
                pickDocument();
              }}
            >
              <Text style={styles.attachmentOptionIcon}>📄</Text>
              <Text style={styles.attachmentOptionText}>Select PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachmentCancelBtn}
              onPress={() => setShowAttachmentModal(false)}
            >
              <Text style={styles.attachmentCancelText}>Cancel</Text>
            </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  monthBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  monthBadgeText: {
    color: '#4ECDC4',
    fontSize: 11,
    fontWeight: '700',
  },
  miniCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  miniCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  miniCardGradient: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  miniCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniCardIcon: {
    fontSize: 20,
  },
  miniCardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4ECDC4',
    marginTop: 2,
  },
  tapToEditRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  tapToEdit: {
    fontSize: 11,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  remainingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  remainingLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  remainingValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  followUpBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  followUpBannerEmpty: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderColor: 'rgba(78, 205, 196, 0.2)',
  },
  followUpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  followUpIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  followUpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E74C3C',
  },
  followUpSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  followUpArrow: {
    fontSize: 18,
    color: '#E74C3C',
    fontWeight: '700',
  },
  viewingOtherMonth: {
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewingOtherMonthText: {
    fontSize: 13,
    color: '#F39C12',
    fontWeight: '500',
  },
  viewingOtherMonthLink: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  quickExpenseSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dollarSign: {
    fontSize: 36,
    fontWeight: '300',
    color: '#4ECDC4',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 150,
    textAlign: 'center',
    padding: 0,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateTimeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  dateTimeTextContainer: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateTimeValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
  },
  todayBadge: {
    fontSize: 9,
    color: '#4ECDC4',
    fontWeight: '700',
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryPrompt: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  categoryButton: {
    width: (width - 80) / 3 - 7,
    borderRadius: 14,
    overflow: 'hidden',
  },
  categoryButtonSelected: {
    transform: [{ scale: 1.02 }],
  },
  categoryButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  categoryButtonIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  categoryButtonName: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryButtonNameSelected: {
    fontWeight: '800',
  },
  selectedCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  attachmentSection: {
    marginBottom: 16,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  attachButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  attachButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  attachmentImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  pdfPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pdfIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  pdfName: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
  },
  removeAttachmentBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(231, 76, 60, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeAttachmentText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '700',
  },
  changeAttachmentBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  changeAttachmentText: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
  recentSection: {
    marginBottom: 24,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  recentIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentCategory: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  attachmentIndicator: {
    fontSize: 12,
    marginLeft: 6,
  },
  recentDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  recentAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  summarySection: {
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  summaryName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  summaryItemRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  summarySpent: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryBudget: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerModal: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: width - 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  monthPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  yearArrowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearArrowText: {
    color: '#4ECDC4',
    fontSize: 16,
  },
  yearText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginHorizontal: 30,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  monthGridItem: {
    width: (width - 40 - 48 - 24) / 4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGridItemSelected: {
    backgroundColor: '#4ECDC4',
  },
  monthGridText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  monthGridTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  monthGridTextCurrent: {
    color: '#4ECDC4',
  },
  currentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4ECDC4',
    marginTop: 4,
  },
  monthPickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  monthPickerCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  monthPickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  monthPickerApplyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
  },
  monthPickerApplyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  goToTodayBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  goToTodayText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  // Web Attachment Modal Styles
  attachmentModalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: width - 60,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  attachmentModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  attachmentModalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  attachmentOptionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  attachmentOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  attachmentCancelBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    marginTop: 6,
  },
  attachmentCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
});
