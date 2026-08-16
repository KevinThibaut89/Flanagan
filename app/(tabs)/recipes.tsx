import { EmptyState, Screen } from '../../src/components/ui';

export default function RecipesScreen() {
  return (
    <Screen>
      <EmptyState title="Recipes" message="Coming next." />
    </Screen>
  );
}
