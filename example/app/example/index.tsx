import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

export const unstable_settings = {
  anchor: "(tabs)",
};

type Example = {
  name: string;
  route?: string;
  variants?: Array<{ name: string; route: string }>;
  style?: any;
};

const examples: Example[] = [
  { name: "Carousel", route: "/example/carousel" },
  {
    name: "Composable Screen",
    variants: [
      { name: "Media", route: "/example/composable-screen-media" },
      { name: "Text & Layout", route: "/example/composable-screen-layout" },
      { name: "Form", route: "/example/composable-screen-form" },
      { name: "Carousel", route: "/example/composable-screen-carousel" },
      { name: "Button", route: "/example/composable-screen-button" },
      { name: "All", route: "/example/composable-screen" },
    ],
  },
  {
    name: "Commitment",
    variants: [
      { name: "List", route: "/example/commitment" },
      { name: "Description", route: "/example/commitment-description" },
    ],
  },
  {
    name: "Loader",
    variants: [
      { name: "Bars", route: "/example/loader" },
      { name: "Circle", route: "/example/loader-circle" },
    ],
  },
  { name: "Media Content", route: "/example/media-content" },
  {
    name: "Picker",
    variants: [
      { name: "Weight", route: "/example/picker" },
      { name: "Height", route: "/example/picker-height" },
      { name: "Name", route: "/example/picker-name" },
      { name: "Date", route: "/example/picker-date" },
    ],
  },
  { name: "Question", route: "/example/question" },
  { name: "Ratings", route: "/example/ratings" },
  { name: "Error Test", route: "/example/error-test", style: { backgroundColor: "#dc2626" } },
];

export default function ExampleIndex() {
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (name: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Onboarding Examples</Text>
        <Text style={styles.subtitle}>Explore different page types</Text>

        <View style={styles.grid}>
          {examples.map((example) => (
            <View key={example.name}>
              <Pressable
                style={[styles.card, example.style]}
                onPress={() => {
                  if (example.route) {
                    router.push(example.route as any);
                  } else if (example.variants) {
                    toggleExpand(example.name);
                  }
                }}
              >
                <View style={styles.cardContent}>
                  <Text style={[styles.cardText, example.style && { color: '#fff' }]}>
                    {example.name}
                  </Text>
                  {example.variants && (
                    <Text style={[styles.chevron, example.style && { color: '#fff' }]}>
                      {expandedItems.has(example.name) ? '▼' : '▶'}
                    </Text>
                  )}
                </View>
              </Pressable>

              {example.variants && expandedItems.has(example.name) && (
                <View style={styles.variantsContainer}>
                  {example.variants.map((variant) => (
                    <Pressable
                      key={variant.route}
                      style={styles.variantCard}
                      onPress={() => router.push(variant.route as any)}
                    >
                      <Text style={styles.variantText}>{variant.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
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
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#007AFF",
    textAlign: "center",
  },
  chevron: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    marginLeft: 8,
  },
  variantsContainer: {
    marginTop: 8,
    marginLeft: 16,
    gap: 8,
  },
  variantCard: {
    backgroundColor: "#f0f7ff",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
  },
  variantText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#007AFF",
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
