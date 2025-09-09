import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Search, MessageCircle, Plus, Calendar, Clock, Trash2, ArrowLeft } from 'lucide-react-native';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { ChatSession, ChatService } from '../../lib/chat/chatService';
import { useUnifiedPersonalization } from '../../hooks/useUnifiedPersonalization';

interface ChatSessionsScreenProps {
  navigation: any;
}

// Extend ChatSession interface with missing properties
interface ExtendedChatSession extends ChatSession {
  mood?: string;
  priority?: 'high' | 'medium' | 'low';
  isBookmarked?: boolean;
  tags?: string[];
  duration?: number;
}

export default function ChatSessionsScreen({ navigation }: ChatSessionsScreenProps) {
  const { user } = useAuth();
  const { getChatSessions, updateChatSession, getChatMessages } = useFirebase();
  const chatService = ChatService.getInstance();
  const { profile: personalization, loading: personalizationLoading } = useUnifiedPersonalization(user?.id || '');
  
  const [sessions, setSessions] = useState<ExtendedChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'priority' | 'theme'>('recent');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const result = await getChatSessions(user!.id);
      if (result.success) {
        const enrichedSessions = await Promise.all(
          result.data.map(async (session: any) => {
            // Get message count from messages collection
            const messagesResult = await getChatMessages(session.id);
            const messageCount = messagesResult.success ? messagesResult.data.length : (session.messageCount || 0);
            
            // Auto-categorize if theme is missing
            let theme = session.theme || 'General';
            let summary = session.summary || 'No summary available';
            
            if ((!session.theme || !session.summary) && messageCount > 2) {
              try {
                const messages = messagesResult.success ? messagesResult.data.slice(0, 10) : [];
                const categorization = await chatService.categorizeSession(messages);
                theme = categorization.theme;
                summary = categorization.summary;
                
                // Update session in Firebase
                await updateChatSession(session.id, { 
                  theme, 
                  summary,
                  messageCount 
                });
              } catch (error) {
                console.error('Error categorizing session:', error);
              }
            }
            
            return {
              ...session,
              theme,
              summary,
              messageCount: messageCount, // Use actual message count from database
              archived: session.archived || false
            };
          })
        );
        
        const sortedSessions = enrichedSessions
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setSessions(sortedSessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load chat sessions');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
  };

  const getSessionsByIntelligentGrouping = () => {
    const now = new Date();
    const grouped = {
      today: sessions.filter(s => {
        const sessionDate = new Date(s.updatedAt);
        return sessionDate.toDateString() === now.toDateString() && !s.archived;
      }),
      thisWeek: sessions.filter(s => {
        const sessionDate = new Date(s.updatedAt);
        const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 0 && daysDiff <= 7 && !s.archived;
      }),
      older: sessions.filter(s => {
        const sessionDate = new Date(s.updatedAt);
        const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 7 && !s.archived;
      }),
      archived: sessions.filter(s => s.archived)
    };
    return grouped;
  };

  const groupedSessions = getSessionsByIntelligentGrouping();

  const getMoodColor = (mood?: string) => {
    switch (mood) {
      case 'positive': return theme.colors.success;
      case 'negative': return theme.colors.danger;
      case 'mixed': return theme.colors.warning;
      default: return theme.colors.gray[400];
    }
  };

  const getPriorityIndicator = (priority?: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '';
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         session.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         session.theme?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const now = new Date();
    const sessionDate = new Date(session.updatedAt);
    const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (filter) {
      case 'recent':
        return matchesSearch && daysDiff <= 7 && !session.archived;
      case 'archived':
        return matchesSearch && session.archived;
      default:
        return matchesSearch && !session.archived;
    }
  });

  const handleCreateNewSession = () => {
    navigation.navigate('ChatMain', { newSession: true });
  };

  const handleSelectSession = (session: ChatSession) => {
    navigation.navigate('ChatMain', { sessionId: session.id });
  };

  const handleArchiveSession = async (sessionId: string) => {
    Alert.alert(
      'Archive Session',
      'Are you sure you want to archive this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateChatSession(sessionId, { archived: true });
              loadSessions();
            } catch (error) {
              Alert.alert('Error', 'Failed to archive session');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getThemeColor = (themeValue: string) => {
    const colors = {
      'Wellness': theme.colors.success,
      'Learning': theme.colors.primary.main,
      'Support': theme.colors.warning,
      'Career': '#8B5CF6',
      'Relationships': '#EC4899',
      'General': theme.colors.gray[400],
    };
    return colors[themeValue as keyof typeof colors] || theme.colors.gray[400];
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'Wellness': return '🌱';
      case 'Learning': return '📚';
      case 'Support': return '💙';
      case 'Career': return '💼';
      case 'Relationships': return '💫';
      default: return '💬';
    }
  };

  const renderSessionWithEnhancements = ({ item }: { item: ExtendedChatSession }) => (
    <TouchableOpacity
      style={[
        styles.sessionCard,
        item.priority === 'high' && styles.urgentSession,
        item.isBookmarked && styles.bookmarkedSession
      ]}
      onPress={() => handleSelectSession(item)}
      activeOpacity={0.7}
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.themeIcon}>
              {getThemeIcon(item.theme || 'General')}
            </Text>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.priority === 'high' && (
              <Text style={styles.urgentBadge}>🔴</Text>
            )}
            {item.isBookmarked && (
              <Text style={styles.bookmark}>⭐</Text>
            )}
          </View>
          
          <View style={styles.sessionMeta}>
            <View style={[styles.themeTag, { backgroundColor: getThemeColor(item.theme || 'General') }]}>
              <Text style={styles.themeText}>{item.theme || 'General'}</Text>
            </View>
            <View style={[styles.moodIndicator, { backgroundColor: getMoodColor(item.mood) }]} />
            <View style={styles.dateContainer}>
              <Clock size={12} color={theme.colors.gray[400]} />
              <Text style={styles.dateText}>{formatDate(item.updatedAt)}</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.archiveButton}
          onPress={(e) => {
            e.stopPropagation();
            handleArchiveSession(item.id);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={16} color={theme.colors.gray[400]} />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sessionSummary} numberOfLines={2}>
        {item.summary || 'No summary available'}
      </Text>
      
      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.slice(0, 3).map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.sessionStats}>
        <View style={styles.sessionStatItem}>
          <MessageCircle size={14} color={theme.colors.gray[400]} />
          <Text style={styles.statText}>{item.messageCount || 0} messages</Text>
        </View>
        {item.duration && (
          <View style={styles.sessionStatItem}>
            <Clock size={14} color={theme.colors.gray[400]} />
            <Text style={styles.statText}>{Math.round(item.duration)}m duration</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = (title: string, count: number) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>({count})</Text>
    </View>
  );

  const renderGroupedSessions = () => {
    const sections = [];
    
    if (filter === 'all' || filter === 'recent') {
      if (groupedSessions.today.length > 0) {
        sections.push(
          <View key="today-section">
            {renderSectionHeader('Today', groupedSessions.today.length)}
            {groupedSessions.today.map((session, index) => (
              <View key={`today-${session.id}-${index}`}>
                {renderSessionWithEnhancements({ item: session })}
              </View>
            ))}
          </View>
        );
      }
      
      if (groupedSessions.thisWeek.length > 0) {
        sections.push(
          <View key="thisWeek-section">
            {renderSectionHeader('This Week', groupedSessions.thisWeek.length)}
            {groupedSessions.thisWeek.map((session, index) => (
              <View key={`thisWeek-${session.id}-${index}`}>
                {renderSessionWithEnhancements({ item: session })}
              </View>
            ))}
          </View>
        );
      }
      
      if (groupedSessions.older.length > 0 && filter === 'all') {
        sections.push(
          <View key="older-section">
            {renderSectionHeader('Older', groupedSessions.older.length)}
            {groupedSessions.older.map((session, index) => (
              <View key={`older-${session.id}-${index}`}>
                {renderSessionWithEnhancements({ item: session })}
              </View>
            ))}
          </View>
        );
      }
    }
    
    if (filter === 'archived' && groupedSessions.archived.length > 0) {
      sections.push(
        <View key="archived-section">
          {renderSectionHeader('Archived', groupedSessions.archived.length)}
          {groupedSessions.archived.map((session, index) => (
            <View key={`archived-${session.id}-${index}`}>
              {renderSessionWithEnhancements({ item: session })}
            </View>
          ))}
        </View>
      );
    }
    
    return sections;
  };

  const renderPersonalizationStats = () => {
    if (!personalization) return null;
    
    return (
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Journey</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {personalization.computed.overallHappiness}
            </Text>
            <Text style={styles.statLabel}>Happiness</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {sessions.length}
            </Text>
            <Text style={styles.statLabel}>Conversations</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {personalization.activityTracking.chatMetrics.engagementStreak}
            </Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {personalization.wellnessProfile.focusAreas.length}
            </Text>
            <Text style={styles.statLabel}>Focus Areas</Text>
          </View>
        </View>
        
        {/* Show focus areas */}
        {personalization.wellnessProfile.focusAreas.length > 0 && (
          <View style={styles.focusAreasContainer}>
            <Text style={styles.focusAreasTitle}>Improving:</Text>
            <View style={styles.focusAreasList}>
              {personalization.wellnessProfile.focusAreas.map(area => (
                <View key={area} style={styles.focusAreaBadge}>
                  <Text style={styles.focusAreaText}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={theme.colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Sessions</Text>
        <TouchableOpacity style={styles.newChatButton} onPress={handleCreateNewSession}>
          <Plus size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Search size={20} color={theme.colors.gray[400]} />
          <TextInput
            style={styles.searchText}
            placeholder="Search conversations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.gray[400]}
          />
        </View>
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'recent', 'archived'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterButton,
              filter === filterOption && styles.filterButtonActive
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text style={[
              styles.filterText,
              filter === filterOption && styles.filterTextActive
            ]}>
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Enhanced stats with personalization */}
      {renderPersonalizationStats()}

      <FlatList
        data={[{ key: 'grouped-sessions' }]}
        renderItem={() => (
          <View style={styles.sessionsList}>
            {renderGroupedSessions()}
          </View>
        )}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        removeClippedSubviews={false} // Disable to prevent rendering issues
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MessageCircle size={48} color={theme.colors.gray[300]} />
            <Text style={styles.emptyTitle}>
              {filter === 'archived' ? 'No archived conversations' : 'No conversations yet'}
            </Text>
            <Text style={styles.emptyDescription}>
              {filter === 'archived' 
                ? 'Archived conversations will appear here'
                : 'Start your first conversation with your AI companion'
              }
            </Text>
            {filter !== 'archived' && (
              <TouchableOpacity style={styles.startChatButton} onPress={handleCreateNewSession}>
                <Text style={styles.startChatText}>Start New Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    paddingTop: theme.spacing[6],
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  backButton: {
    padding: theme.spacing[1],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    flex: 1,
    textAlign: 'center',
  },
  newChatButton: {
    backgroundColor: theme.colors.primary.main,
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.white,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  searchText: {
    flex: 1,
    marginLeft: theme.spacing[2],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[900],
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[3],
    backgroundColor: theme.colors.white,
  },
  filterButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing[2],
    backgroundColor: theme.colors.gray[100],
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary.main,
  },
  filterText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  filterTextActive: {
    color: theme.colors.white,
  },
  sessionsList: {
    paddingBottom: theme.spacing[4],
  },
  sessionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    marginBottom: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing[2],
  },
  sessionInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[1],
  },
  themeIcon: {
    fontSize: theme.typography.fontSize.base,
    marginRight: theme.spacing[2],
  },
  sessionTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeTag: {
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1] / 2,
    borderRadius: theme.borderRadius.sm,
  },
  themeText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
    fontWeight: theme.typography.fontWeight.medium,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    marginLeft: theme.spacing[1],
  },
  archiveButton: {
    padding: theme.spacing[1],
  },
  sessionSummary: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    lineHeight: 20,
    marginBottom: theme.spacing[3],
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    marginLeft: theme.spacing[1],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing[8],
    paddingHorizontal: theme.spacing[4],
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[700],
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[500],
    textAlign: 'center',
    marginBottom: theme.spacing[4],
    lineHeight: 22,
  },
  startChatButton: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing[2],
  },
  startChatText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
  },
  urgentSession: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger,
  },
  bookmarkedSession: {
    borderTopWidth: 2,
    borderTopColor: theme.colors.warning,
  },
  urgentBadge: {
    fontSize: theme.typography.fontSize.sm,
    marginLeft: theme.spacing[1],
  },
  moodIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing[1],
  },
  bookmark: {
    fontSize: theme.typography.fontSize.base,
    marginLeft: theme.spacing[1],
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing[2],
    gap: theme.spacing[1],
  },
  tag: {
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1] / 2,
    borderRadius: theme.borderRadius.sm,
  },
  tagText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    backgroundColor: theme.colors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
  },
  sectionCount: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    marginLeft: theme.spacing[2],
  },
  statsCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing[4],
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: theme.spacing[3],
  },
  statsTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginBottom: theme.spacing[3],
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    ...theme.typography.h3,
    color: theme.colors.primary.main,
    fontWeight: 'bold',
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  focusAreasContainer: {
    marginTop: theme.spacing[2],
  },
  focusAreasTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing[1],
  },
  focusAreasList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[1],
  },
  focusAreaBadge: {
    backgroundColor: theme.colors.primary.light,
    paddingVertical: theme.spacing[1] / 2,
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  focusAreaText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.medium,
  },
});