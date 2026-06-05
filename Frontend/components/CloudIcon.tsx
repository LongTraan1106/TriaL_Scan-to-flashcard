import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

interface CloudIconProps {
  size?: number;
  color?: string;
}

export const CloudIcon: React.FC<CloudIconProps> = ({
  size = 150,
  color = '#E8F0EB',
}) => {
  return (
    <View style={[styles.container, { width: size, height: size * 0.75 }]}>
      {/* Cloud shape using circles/oval */}
      <View
        style={[
          styles.cloudBody,
          {
            backgroundColor: color,
            width: size * 0.8,
            height: size * 0.5,
          },
        ]}
      />
      
      {/* Eyes */}
      <View style={styles.eyesContainer}>
        <View style={styles.eye} />
        <View style={styles.eye} />
      </View>

      {/* Smile indicator */}
      <View
        style={[
          styles.mouth,
          {
            bottom: size * 0.15,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cloudBody: {
    borderRadius: 50,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  eyesContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: '25%',
    gap: 20,
  },
  eye: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
  },
  mouth: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333333',
    position: 'absolute',
  },
});
