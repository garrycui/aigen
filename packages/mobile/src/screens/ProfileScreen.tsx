import React from 'react';
import { View, Text } from 'react-native';
import { User } from 'lucide-react-native';
import { screenStyles, colors } from '../theme';

export default function ProfileScreen() {
  return (
    <View style={screenStyles.perplexityContainer}>
      <View style={screenStyles.perplexityHeader}>
        <User size={36} color={colors.primary.main} />
        <Text style={screenStyles.perplexityHeaderTitle}>Profile</Text>
      </View>
      <View style={screenStyles.perplexityCard}>
        <View style={screenStyles.perplexityAvatar}>
          <User size={48} color={colors.primary.light} />
        </View>
        <Text style={screenStyles.perplexityProfileName}>Your Name</Text>
        <Text style={screenStyles.perplexityProfileEmail}>you@email.com</Text>
      </View>
    </View>
  );
}
