import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';

// Keep lightweight typing local to this screen to avoid project-wide refactors
// The screen reads optional lat/lon string params from deep link or navigation

type RootStackParamList = {
  LocationDebug: { lat?: string; lon?: string } | undefined;
};

const LocationDebugScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'LocationDebug'>>();
  const lat = route.params?.lat ?? 'N/A';
  const lon = route.params?.lon ?? 'N/A';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mocked Coordinates</Text>
      <Text style={styles.coord}>Latitude: {lat}</Text>
      <Text style={styles.coord}>Longitude: {lon}</Text>
      <Text style={styles.hint}>Opened from foreground service notification.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  coord: { fontSize: 16, marginVertical: 4 },
  hint: { marginTop: 16, color: '#666' },
});

export default LocationDebugScreen;
