import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Mail, Lock, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

const LoginScreen = () => {
  const { signIn, signUp, googleSignIn } = useAuth() as any;
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (!isLogin && !acceptedTerms) {
      Alert.alert('Error', 'Please accept the Terms of Service and Privacy Policy');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          Alert.alert('Error', error);
        }
      } else {
        const { error } = await signUp(email, password, name);
        if (error) {
          Alert.alert('Error', error);
        }
      }
    } catch (error) {
      console.error('LOGIN ERROR', error);
      Alert.alert('Error', (error as Error)?.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await googleSignIn();
      if (error) {
        Alert.alert('Error', error);
      }
    } catch {
      Alert.alert('Error', 'Failed to sign in with Google');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.centeredContainer}>
        <View style={styles.card}>
          <Text style={styles.headerTitle}>{isLogin ? 'Sign in to continue' : 'Create your account'}</Text>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, isLogin && styles.activeTab]}
              onPress={() => setIsLogin(true)}
              disabled={isSubmitting}
            >
              <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, !isLogin && styles.activeTab]}
              onPress={() => setIsLogin(false)}
              disabled={isSubmitting}
            >
              <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or</Text>
            <View style={styles.dividerLine} />
          </View>
          {!isLogin && (
            <View style={styles.inputContainer}>
              <User size={20} color={theme.colors.gray[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isSubmitting}
                placeholderTextColor={theme.colors.gray[400]}
              />
            </View>
          )}
          <View style={styles.inputContainer}>
            <Mail size={20} color={theme.colors.gray[400]} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isSubmitting}
              placeholderTextColor={theme.colors.gray[400]}
            />
          </View>
          <View style={styles.inputContainer}>
            <Lock size={20} color={theme.colors.gray[400]} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isSubmitting}
              placeholderTextColor={theme.colors.gray[400]}
            />
          </View>
          {!isLogin && (
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                disabled={isSubmitting}
              >
                <View style={[styles.checkboxInner, acceptedTerms && styles.checkboxChecked]} />
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I agree to the Terms of Service and Privacy Policy
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'Sign in' : 'Start Free Trial'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[5],
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing[6],
    width: '100%',
    maxWidth: 400,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing[6],
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: theme.spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary.main,
  },
  tabText: {
    color: theme.colors.gray[400],
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
  },
  activeTabText: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  googleButton: {
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    alignItems: 'center',
    marginBottom: theme.spacing[5],
  },
  googleButtonText: {
    color: theme.colors.gray[700],
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[5],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray[200],
  },
  dividerText: {
    marginHorizontal: theme.spacing[3],
    color: theme.colors.gray[400],
    fontSize: theme.typography.fontSize.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing[4],
    paddingHorizontal: theme.spacing[3],
    backgroundColor: theme.colors.gray[100],
  },
  inputIcon: {
    marginRight: theme.spacing[2],
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[900],
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[5],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing[2],
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    flex: 1,
    borderRadius: theme.borderRadius.base,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary.main,
  },
  termsText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
  },
  submitButton: {
    backgroundColor: theme.colors.primary.main,
    paddingVertical: theme.spacing[4],
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    marginTop: theme.spacing[2],
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});

export default LoginScreen;