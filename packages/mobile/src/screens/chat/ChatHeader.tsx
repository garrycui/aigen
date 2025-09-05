import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Menu, Plus, MessageSquare, Clock } from 'lucide-react-native';
import { theme } from '../../theme';
import { ChatSession } from '../../lib/chat/chatService';

interface ChatHeaderProps {
  session: ChatSession | null;
  sessionTitle: string;
  isLoading: boolean;
  onViewSessions: () => void;
  onNewSession: () => void;
}

export default function ChatHeader({ 
  session, 
  sessionTitle,
  isLoading, 
  onViewSessions,
  onNewSession 
}: ChatHeaderProps) {
  const formatLastActive = (updatedAt: string) => {
    // Add validation for empty or invalid date strings
    if (!updatedAt) return 'Unknown';
    
    const date = new Date(updatedAt);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    
    // Use a more reliable date formatting
    try {
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Unknown';
    }
  };

  const getThemeIcon = (theme?: string) => {
    switch (theme) {
      case 'Wellness':
        return '🌱';
      case 'Learning':
        return '📚';
      case 'Support':
        return '💙';
      case 'Career':
        return '💼';
      case 'Relationships':
        return '💫';
      default:
        return '💬';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={onViewSessions}
        >
          <Menu size={24} color={theme.colors.gray[600]} />
        </TouchableOpacity>
        
        <View style={styles.sessionInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.themeIcon}>
              {getThemeIcon(session?.theme)}
            </Text>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {sessionTitle}
            </Text>
          </View>
          {session && (
            <View style={styles.sessionMeta}>
              <Clock size={12} color={theme.colors.gray[400]} />
              <Text style={styles.sessionSubtitle}>
                {formatLastActive(session.updatedAt)} • {session.messageCount || 0} messages
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity 
          style={[styles.newChatButton, isLoading && styles.disabledButton]}
          onPress={onNewSession}
          disabled={isLoading}
        >
          <Plus size={20} color={isLoading ? theme.colors.gray[400] : theme.colors.primary.main} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
    paddingTop: theme.spacing[6], // Account for status bar
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: theme.spacing[2],
    marginRight: theme.spacing[2],
  },
  sessionInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[1] / 2,
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
  },
  sessionSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    marginLeft: theme.spacing[1],
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newChatButton: {
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[100],
  },
  disabledButton: {
    opacity: 0.5,
  },
});