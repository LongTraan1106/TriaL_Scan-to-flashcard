import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Homeicon from '../assets/icons/home.svg';
import Docicon from '../assets/icons/doc.svg';
import flashicon from '../assets/icons/flashcard.svg';
import profileicon from '../assets/icons/profile.svg';
import Scanicon from '../assets/icons/scan.svg';

interface NavItem {
  id: number;
  routeName: string;
  IconComponent: React.ComponentType<{
    width: number;
    height: number;
    style?: any;
  }>;
  label: string;
}

export function BottomNavigationBar() {
  const navigation = useNavigation<any>();
  const route = useRoute();

  const navItems: NavItem[] = [
    { id: 1, routeName: 'Home', IconComponent: Homeicon, label: 'Home' },
    { id: 2, routeName: 'Documents', IconComponent: Docicon, label: 'Docs' },
    { id: 3, routeName: 'Camera', IconComponent: Scanicon, label: 'Scan' },
    { id: 4, routeName: 'Flashcard', IconComponent: flashicon, label: 'Flashcard' },
    { id: 5, routeName: 'Profile', IconComponent: profileicon, label: 'Profile' },
  ];

  const handleNavigation = (screenName: string) => {
    if (screenName === 'Camera') {
      // Navigate to Camera as a modal
      navigation.navigate('Camera');
    } else {
      // Navigate to tab screen
      navigation.navigate('TabNavigator', { screen: screenName });
    }
  };

  // Get current screen name - tab được render bên trong wrapper
  // Nên route.name sẽ là tên của tab screen (Home, Documents, etc)
  let currentScreen = route.name || 'Home';

  return (
    <View style={styles.bottomNav}>
      {navItems.map(item => {
        const { IconComponent } = item;
        const isCenterItem = item.id === 3;
        const isActive = currentScreen === item.routeName;

        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.navItem, isCenterItem && styles.centerNavItem]}
            activeOpacity={0.9}
            onPress={() => handleNavigation(item.routeName)}
          >
            <View
              style={[
                styles.navIconContainer,
                isCenterItem && styles.centerIconContainer,
                isActive && !isCenterItem && styles.activeIndicator,
              ]}
            >
              <IconComponent
                width={isCenterItem ? 36 : 28}
                height={isCenterItem ? 36 : 28}
                style={styles.navIcon}
              />
            </View>
            {!isCenterItem && (
              <Text style={{ fontSize: 10, color: '#333' }}>{item.label}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

}

const styles = StyleSheet.create({
  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#8B9D8A',
    paddingVertical: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 20,
    marginBottom: 10,
    marginHorizontal: 15,
    position: 'relative',
  },
  navItem: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  centerNavItem: {
    width: 65,
    height: 0,
    marginBottom: 35,
  },
  navIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIconContainer: {
    width: 65,
    height: 65,
    borderRadius: 40,
    backgroundColor: '#C5D8C0',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#8B9D8A',
    borderWidth: 5,
  },
  navIcon: {
    fontSize: 28,
  },
  activeIndicator: {
    backgroundColor: '#AEC3B0',
    borderRadius: 50,
    width: 45,
    height: 45,
  },
});
