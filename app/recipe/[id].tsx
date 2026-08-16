import { EmptyState, Screen } from '../../src/components/ui';

export default function RecipeDetailScreen() {
  return (
    <Screen>
      <EmptyState title="Recipe" message="Coming next." />
    </Screen>
  );
}
