import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  RefreshControl,
  ActivityIndicator 
} from 'react-native';
import { Search, Filter, Book, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getTutorials, TUTORIAL_CATEGORIES } from '@shared/lib/tutorial/tutorials';
import TutorialCard from '../components/tutorial/TutorialCard';

const DIFFICULTY_LEVELS = [
  'All',
  'beginner',
  'intermediate',
  'advanced'
];

const TutorialsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [tutorials, setTutorials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTutorials = async () => {
    try {
      setIsLoading(true);
      const fetchedTutorials = await getTutorials(
        1,
        10,
        searchQuery,
        selectedCategories.length > 0 ? selectedCategories : undefined,
        selectedDifficulties.length > 0 ? selectedDifficulties : undefined
      );
      setTutorials(fetchedTutorials);
    } catch (error) {
      console.error('Error loading tutorials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTutorials();
  }, [searchQuery, selectedCategories, selectedDifficulties]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTutorials();
    setRefreshing(false);
  };

  const handleCategoryToggle = (category: string) => {
    if (category === 'All') {
      setSelectedCategories([]);
      return;
    }
    
    setSelectedCategories(prev => {
      const isSelected = prev.includes(category);
      if (isSelected) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleDifficultyToggle = (difficulty: string) => {
    if (difficulty === 'All') {
      setSelectedDifficulties([]);
      return;
    }
    
    setSelectedDifficulties(prev => {
      const isSelected = prev.includes(difficulty);
      if (isSelected) {
        return prev.filter(d => d !== difficulty);
      } else {
        return [...prev, difficulty];
      }
    });
  };

  const renderTutorialCard = ({ item }) => (
    <TutorialCard
      tutorial={item}
      onPress={() => navigation.navigate('TutorialDetail', { id: item.id })}
    />
  );

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading tutorials...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Adaptation Tutorials</Text>
          <Text style={styles.subtitle}>Learn and master AI tools</Text>
        </View>
        <TouchableOpacity 
          style={styles.generateButton}
          onPress={() => navigation.navigate('GenerateTutorial')}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.generateButtonText}>Generate</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tutorials..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color="#4b5563" />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filterTitle}>Categories</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {TUTORIAL_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterChip,
                  selectedCategories.includes(category) && styles.filterChipActive
                ]}
                onPress={() => handleCategoryToggle(category)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedCategories.includes(category) && styles.filterChipTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.filterTitle, { marginTop: 12 }]}>Difficulty</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {DIFFICULTY_LEVELS.map((difficulty) => (
              <TouchableOpacity
                key={difficulty}
                style={[
                  styles.filterChip,
                  selectedDifficulties.includes(difficulty) && styles.filterChipActive
                ]}
                onPress={() => handleDifficultyToggle(difficulty)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedDifficulties.includes(difficulty) && styles.filterChipTextActive
                ]}>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={tutorials}
        renderItem={renderTutorialCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Book size={48} color="#9ca3af" />
            <Text style={styles.emptyStateTitle}>No tutorials found</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your search or filters
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#ffffff',
    marginLeft: 4,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  filtersPanel: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#e0e7ff',
  },
  filterChipText: {
    color: '#4b5563',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#4f46e5',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default TutorialsScreen;