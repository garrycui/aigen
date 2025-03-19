import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Search, MessageSquare, ThumbsUp, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { fetchPosts, toggleLike } from '@shared/lib/post/post';

const ForumScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const response = await fetchPosts();
      setPosts(response.data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    if (!user) return;

    try {
      await toggleLike('post', postId, user.id);
      // Refresh posts to show updated like count
      loadPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const renderPost = ({ item }) => (
    <TouchableOpacity 
      style={styles.postCard}
      onPress={() => navigation.navigate('PostDetail', { id: item.id })}
    >
      <View style={styles.postHeader}>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content} numberOfLines={3}>
        {item.content}
      </Text>

      <View style={styles.postFooter}>
        <View style={styles.stats}>
          <TouchableOpacity 
            style={styles.statButton}
            onPress={() => handleLike(item.id)}
          >
            <ThumbsUp 
              size={16} 
              color={item.is_liked ? '#4f46e5' : '#6b7280'}
            />
            <Text style={styles.statText}>{item.likes_count}</Text>
          </TouchableOpacity>
          
          <View style={styles.stat}>
            <MessageSquare size={16} color="#6b7280" />
            <Text style={styles.statText}>{item.comments_count}</Text>
          </View>
        </View>
        
        <Text style={styles.author}>by {item.user_name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community Forum</Text>
        <TouchableOpacity 
          style={styles.newPostButton}
          onPress={() => navigation.navigate('NewPost')}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.newPostText}>New Post</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search posts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
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
  newPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newPostText: {
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
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  listContent: {
    padding: 16,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    backgroundColor: '#e0e7ff',
    color: '#4f46e5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  date: {
    color: '#6b7280',
    fontSize: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  content: {
    color: '#4b5563',
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  statButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 4,
    color: '#6b7280',
    fontSize: 14,
  },
  author: {
    color: '#6b7280',
    fontSize: 12,
  },
});

export default ForumScreen;