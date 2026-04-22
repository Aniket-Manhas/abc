import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function LoadingScreen({ message }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accentSaffron} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
