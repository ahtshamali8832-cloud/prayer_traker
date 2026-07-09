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
  TouchableOpacity,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide-react-native';
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
  secureTextEntry,
  ...props
}: AppTextInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPasswordField = secureTextEntry === true;

  return (
    <View style={[styles.field, containerStyle]}>
      <View style={styles.labelRow}>
        {Icon ? <Icon size={16} color={colors.textMuted} /> : null}
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <View
        style={[
          styles.inputWrap,
          isPasswordField && styles.inputWrapRow,
          {
            backgroundColor: colors.card,
            borderColor: focused ? colors.primary : colors.border,
          },
        ]}>
        <TextInput
          {...props}
          secureTextEntry={isPasswordField && !passwordVisible}
          style={[
            styles.input,
            isPasswordField && styles.inputWithToggle,
            { color: colors.text },
            style,
          ]}
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
        {isPasswordField ? (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setPasswordVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {passwordVisible ? (
              <EyeOff size={20} color={colors.textMuted} />
            ) : (
              <Eye size={20} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        ) : null}
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
  inputWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWithToggle: {
    flex: 1,
  },
  eyeButton: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
