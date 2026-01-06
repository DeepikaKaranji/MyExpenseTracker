import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Homepage from './screens/Homepage';
import MonthlyBudgetAlloc from './screens/MonthlyBudgetAlloc';
import CurrentMonthTrackedExpenses from './screens/CurrentMonthTrackedExpenses';
import FollowUpScreen from './screens/FollowUpScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Homepage"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Homepage" component={Homepage} />
        <Stack.Screen name="MonthlyBudgetAlloc" component={MonthlyBudgetAlloc} />
        <Stack.Screen name="CurrentMonthTrackedExpenses" component={CurrentMonthTrackedExpenses} />
        <Stack.Screen name="FollowUpScreen" component={FollowUpScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
