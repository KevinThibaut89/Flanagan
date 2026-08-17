import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Body, Flourish, Monogram, Muted, Screen, Title } from '../../src/components/ui';
import { useAuth } from '../../src/providers/auth';
import { colors, spacing, typography } from '../../src/theme';

type Step = 'email' | 'code';

export default function SignIn() {
  const { sendCode, verifyCode } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendCode() {
    setError(null);
    if (!email.includes('@')) {
      setError('That doesn’t look like an email address.');
      return;
    }
    setBusy(true);
    try {
      await sendCode(email);
      setStep('code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setError(null);
    if (code.trim().length === 0) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    try {
      await verifyCode(email, code);
      // The auth listener in the root layout handles the redirect.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code was not accepted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Monogram size={72} />
            <Title style={styles.brand}>Flanagan</Title>
            <Flourish style={styles.tagline}>Your bar, and what it can make tonight.</Flourish>
          </View>

          {step === 'email' ? (
            <View style={styles.form}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                returnKeyType="go"
                onSubmitEditing={handleSendCode}
                error={error}
                hint="We’ll email you a sign-in code."
              />
              <Button label="Send code" onPress={handleSendCode} loading={busy} />
            </View>
          ) : (
            <View style={styles.form}>
              <Body>
                Enter the code we sent to <Body style={styles.email}>{email}</Body>.
              </Body>
              <TextField
                label="Sign-in code"
                value={code}
                onChangeText={setCode}
                placeholder="Enter the code"
                keyboardType="number-pad"
                inputMode="numeric"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={10}
                returnKeyType="go"
                onSubmitEditing={handleVerify}
                error={error}
              />
              <Button label="Sign in" onPress={handleVerify} loading={busy} />
              <Button
                label="Use a different email"
                variant="ghost"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  brand: {
    ...typography.display,
    fontSize: 38,
    lineHeight: 46,
    marginTop: spacing.md,
  },
  tagline: {
    textAlign: 'center',
    color: colors.textMuted,
  },
  form: {
    gap: spacing.lg,
  },
  email: {
    color: colors.accentSoft,
    fontWeight: '600',
  },
});
