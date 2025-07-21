import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius } from './spacing';

export const screenStyles = StyleSheet.create({
  // Common Screen Layouts
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  
  centeredContainer: {
    flex: 1,
    backgroundColor: colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  
  // Headers
  screenHeader: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  
  headerTitle: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginTop: spacing[4],
  },
  
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing[2],
  },
  
  // Content Areas
  content: {
    flex: 1,
    padding: spacing[4],
  },
  
  contentWithPadding: {
    padding: spacing[4],
  },
  
  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  
  loadingText: {
    marginTop: spacing[3],
    color: colors.gray[500],
    fontSize: typography.fontSize.base,
  },
  
  // Empty States
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[700],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[500],
    textAlign: 'center',
  },

  // HomeScreen Styles
  header: {
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  buttonContainer: {
    width: '100%',
    gap: spacing[3],
  },
  primaryButton: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Perplexity Styles
  perplexityContainer: {
    flex: 1,
    backgroundColor: colors.gray[50],
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  perplexityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  perplexityHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray[900],
    marginLeft: 8,
  },
  perplexityCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 24,
  },
  perplexitySubtitle: {
    fontSize: 16,
    color: colors.gray[500],
    marginBottom: 20,
    fontWeight: '500',
  },
  perplexitySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
  },
  perplexityInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray[900],
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
  perplexitySendButton: {
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    padding: 8,
    marginLeft: 8,
  },
  perplexitySuggestionList: {
    marginTop: 8,
  },
  perplexitySuggestionCard: {
    backgroundColor: colors.gray[100],
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  perplexitySuggestionText: {
    fontSize: 15,
    color: colors.gray[900],
    fontWeight: '500',
  },
  perplexityEmptyState: {
    alignItems: 'center',
    marginTop: 24,
  },
  perplexityEmptyText: {
    color: colors.gray[500],
    fontSize: 16,
    marginTop: 12,
  },
  perplexityAvatar: {
    alignSelf: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: 40,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  perplexityProfileName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: 4,
  },
  perplexityProfileEmail: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: 'center',
  },
});