import React from 'react';
import { View } from 'react-native';
import { BottomNavigationBar } from '../components/BottomNavigationBar';

interface TabScreenWrapperProps {
  children: React.ReactNode;
}

export function TabScreenWrapper({ children }: TabScreenWrapperProps) {
  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#E3EED4' }}>
      {children}
      <BottomNavigationBar />
    </View>
  );
}
