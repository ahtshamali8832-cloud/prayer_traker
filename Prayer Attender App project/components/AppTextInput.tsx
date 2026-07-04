import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/lib/themeContext';

interface AppTextInputProps extends TextInputProps {
  label: string;
  icon?: LucideIcon;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AppTextInput({
  label,
  icon: Icon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  placeholderTextColor,
  ...props
}: AppTextInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <View style={styles.labelRow}>
        {Icon ? <Icon size={16} color={colors.textMuted} /> : null}
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.card,
            borderColor: focused ? colors.primary : colors.border,
          },
        ]}>
        <TextInput
          {...props}
          style={[styles.input, { color: colors.text }, style]}
          placeholderTextColor={placeholderTextColor ?? colors.textMuted}
          underlineColorAndroid="transparent"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
      </View>
    </View>
  );
}

interface AppSearchInputProps extends Omit<TextInputProps, 'style'> {
  icon?: LucideIcon;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AppSearchInput({
  icon: Icon,
  containerStyle,
  onFocus,
  onBlur,
  placeholderTextColor,
  ...props
}: AppSearchInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.searchWrap,
        {
          backgroundColor: colors.card,
          borderColor: focused ? colors.primary : colors.border,
        },
        containerStyle,
      ]}>
      {Icon ? <Icon size={18} color={colors.textMuted} /> : null}
      <TextInput
        {...props}
        style={[styles.searchInput, { color: colors.text }]}
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        underlineColorAndroid="transparent"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
    </View>
  );
}

const webInputReset = Platform.select({
  web: {
    outlineStyle: 'solid',
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  default: {},
});

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 14,
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    padding: 0,
    margin: 0,
    ...webInputReset,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    margin: 0,
    ...webInputReset,
  },
});
