import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";

export const unstable_settings = {
  anchor: "(tabs)",
};

const examples = [
  { name: "Carousel", route: "/example/carousel" },
  { name: "Commitment (List)", route: "/example/commitment" },
  { name: "Commitment (Description)", route: "/example/commitment-description" },
  { name: "Loader (Bars)", route: "/example/loader" },
  { name: "Loader (Circle)", route: "/example/loader-circle" },
  { name: "Media Content", route: "/example/media-content" },
  { name: "Picker (Weight)", route: "/example/picker" },
  { name: "Picker (Height)", route: "/example/picker-height" },
  { name: "Picker (Name)", route: "/example/picker-name" },
  { name: "Ratings", route: "/example/ratings" },
  { name: "Question", route: "/example/question" },
  { name: "Error Test", route: "/example/error-test", style: { backgroundColor: "#dc2626" } },
];

export default function ExampleIndex() {
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Onboarding Examples</Text>
        <Text style={styles.subtitle}>Explore different page types</Text>

        <View style={styles.grid}>
          {examples.map((example) => (
            <Pressable
              key={example.route}
              style={[styles.card, example.style]}
              onPress={() => router.push(example.route as any)}
            >
              <Text style={[styles.cardText, example.style && { color: '#fff' }]}>
                {example.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 60,
    textAlign: "center",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: "center",
    color: "#666",
  },
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#007AFF",
    textAlign: "center",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 32,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 32,
    fontWeight: "400",
    lineHeight: 32,
  },
});
