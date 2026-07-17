import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStart } from '@rocapine/react-native-onboarding';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function OnboardingIndex() {
  const router = useRouter();
  // Resolve the entry point from metadata.startStepId (falls back to step 1).
  const { startStepNumber } = useOnboardingStart();

  const handleStartQuestion1 = () => {
    router.push(`/onboarding/${startStepNumber}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Onboarding</Text>
      <Text style={styles.subtitle}>Choose your starting point</Text>

      <Pressable style={styles.button} onPress={handleStartQuestion1}>
        <Text style={styles.buttonText}>Start Question 1</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
