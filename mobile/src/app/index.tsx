import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://YOUR-MAC-IP:5001";

const PURPLE = "#6C35DE";
const DARK = "#171321";
const MUTED = "#77717F";
const LIGHT = "#F7F3FC";
const BORDER = "#E7E0F0";

type Screen = "language" | "terms" | "phone" | "otp" | "home";

export default function Index() {
  const [screen, setScreen] = useState<Screen>("language");
  const [language, setLanguage] = useState("English");
  const [accepted, setAccepted] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const sendOTP = async () => {
    if (phone.length !== 10) {
      Alert.alert("Invalid number", "Enter a 10-digit phone number.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to send OTP");
      }

      setScreen("otp");
    } catch (error: any) {
      Alert.alert("OTP Error", error.message || "Unable to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Enter the 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid OTP");
      }

      const token = data.token || data.jwt || data.accessToken;

      if (token) {
        await AsyncStorage.setItem("phonemail_token", token);
      }

      await AsyncStorage.setItem("phonemail_user", JSON.stringify(data.user || data));

      setScreen("home");
    } catch (error: any) {
      Alert.alert("Verification failed", error.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  if (screen === "language") {
    return (
      <ScreenWrapper>
        <View style={styles.logoCircle}>
          <Text style={styles.logo}>P</Text>
        </View>

        <Text style={styles.title}>Welcome to PhoneMail</Text>
        <Text style={styles.subtitle}>
          Your phone number. Your email identity.
        </Text>

        <Text style={styles.sectionTitle}>Choose your language</Text>

        {["English", "Tamil", "Hindi", "Telugu", "Kannada"].map((item) => (
          <Pressable
            key={item}
            style={[
              styles.languageRow,
              language === item && styles.languageSelected,
            ]}
            onPress={() => setLanguage(item)}
          >
            <Text
              style={[
                styles.languageText,
                language === item && styles.languageSelectedText,
              ]}
            >
              {item}
            </Text>

            <View
              style={[
                styles.radio,
                language === item && styles.radioSelected,
              ]}
            >
              {language === item && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        ))}

        <PrimaryButton title="Continue" onPress={() => setScreen("terms")} />
      </ScreenWrapper>
    );
  }

  if (screen === "terms") {
    return (
      <ScreenWrapper>
        <BackButton onPress={() => setScreen("language")} />

        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>
          Please review the terms before creating your PhoneMail account.
        </Text>

        <ScrollView style={styles.termsBox}>
          <Text style={styles.termsTitle}>PhoneMail Terms</Text>
          <Text style={styles.termsText}>
            By continuing, you agree to use PhoneMail responsibly and provide
            accurate account information. Your phone number is used as your
            PhoneMail identity.
          </Text>

          <Text style={styles.termsTitle}>Privacy</Text>
          <Text style={styles.termsText}>
            PhoneMail uses your verified phone number for authentication and
            account creation.
          </Text>

          <Text style={styles.termsTitle}>Email usage</Text>
          <Text style={styles.termsText}>
            Do not use PhoneMail for unlawful, abusive, or harmful activities.
          </Text>
        </ScrollView>

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setAccepted(!accepted)}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
            {accepted && <Text style={styles.check}>✓</Text>}
          </View>

          <Text style={styles.checkboxText}>
            I agree to the Terms & Conditions
          </Text>
        </Pressable>

        <PrimaryButton
          title="Continue"
          disabled={!accepted}
          onPress={() => setScreen("phone")}
        />
      </ScreenWrapper>
    );
  }

  if (screen === "phone") {
    return (
      <ScreenWrapper>
        <BackButton onPress={() => setScreen("terms")} />

        <View style={styles.logoCircle}>
          <Text style={styles.logo}>P</Text>
        </View>

        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>
          We'll send a one-time password to verify your number.
        </Text>

        <Text style={styles.inputLabel}>Phone number</Text>

        <View style={styles.phoneInput}>
          <Text style={styles.countryCode}>+91</Text>
          <TextInput
            value={phone}
            onChangeText={(value) =>
              setPhone(value.replace(/[^0-9]/g, "").slice(0, 10))
            }
            keyboardType="phone-pad"
            placeholder="9876543210"
            placeholderTextColor="#AAA3B1"
            style={styles.phoneField}
            maxLength={10}
          />
        </View>

        <Text style={styles.helper}>
          Your PhoneMail address will use this verified number.
        </Text>

        <PrimaryButton
          title={loading ? "Sending OTP..." : "Send OTP"}
          disabled={loading || phone.length !== 10}
          onPress={sendOTP}
        />
      </ScreenWrapper>
    );
  }

  if (screen === "otp") {
    return (
      <ScreenWrapper>
        <BackButton onPress={() => setScreen("phone")} />

        <View style={styles.logoCircle}>
          <Text style={styles.logo}>P</Text>
        </View>

        <Text style={styles.title}>Enter verification code</Text>

        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to +91 {phone}.
        </Text>

        <TextInput
          value={otp}
          onChangeText={(value) =>
            setOtp(value.replace(/[^0-9]/g, "").slice(0, 6))
          }
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          style={styles.otpInput}
          placeholder="------"
          placeholderTextColor="#BDB6C5"
        />

        <Text style={styles.otpHint}>
          Your phone may automatically suggest the OTP.
        </Text>

        <PrimaryButton
          title={loading ? "Verifying..." : "Verify & Continue"}
          disabled={loading || otp.length !== 6}
          onPress={verifyOTP}
        />

        <Pressable onPress={sendOTP} style={styles.resend}>
          <Text style={styles.resendText}>Resend OTP</Text>
        </Pressable>
      </ScreenWrapper>
    );
  }

  return (
    <SafeAreaView style={styles.home}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.homeGreeting}>PhoneMail</Text>
          <Text style={styles.homeId}>{phone}@phonemail.com</Text>
        </View>

        <Pressable style={styles.profile}>
          <Text style={styles.profileText}>
            {phone ? phone[0] : "P"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
          placeholderTextColor="#9992A2"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
      >
        {["All", "Unread", "Attachments", "Favorites"].map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.chip, filter === item && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                filter === item && styles.chipTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.emptyArea}>
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>✉</Text>
        </View>

        <Text style={styles.emptyTitle}>Your conversations</Text>

        <Text style={styles.emptyText}>
          Start a conversation by searching for a PhoneMail number.
        </Text>

        <Pressable style={styles.startButton}>
          <Text style={styles.startButtonText}>Start conversation</Text>
        </Pressable>
      </View>

      <Pressable style={styles.composeButton}>
        <Text style={styles.composeText}>＋</Text>
      </Pressable>

      <View style={styles.bottomNav}>
        <Text style={styles.navActive}>Home</Text>
        <Text style={styles.navItem}>Drafts</Text>
        <Text style={styles.navItem}>Spam</Text>
        <Text style={styles.navItem}>Trash</Text>
      </View>
    </SafeAreaView>
  );
}

function ScreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backButton}>
      <Text style={styles.backText}>‹ Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 36,
    paddingBottom: 40,
  },

  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  logo: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
  },

  title: {
    color: DARK,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 10,
  },

  subtitle: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 30,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: DARK,
    marginBottom: 12,
  },

  languageRow: {
    height: 58,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },

  languageSelected: {
    borderColor: PURPLE,
    backgroundColor: "#F5F0FF",
  },

  languageText: {
    fontSize: 16,
    color: DARK,
    fontWeight: "600",
  },

  languageSelectedText: {
    color: PURPLE,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#BDB6C5",
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: PURPLE,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PURPLE,
  },

  primaryButton: {
    height: 56,
    backgroundColor: PURPLE,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  backButton: {
    marginBottom: 24,
  },

  backText: {
    color: PURPLE,
    fontSize: 16,
    fontWeight: "700",
  },

  termsBox: {
    backgroundColor: LIGHT,
    borderRadius: 16,
    padding: 18,
    maxHeight: 330,
  },

  termsTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: DARK,
    marginBottom: 8,
    marginTop: 8,
  },

  termsText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 22,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
  },

  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#BDB6C5",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },

  check: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  checkboxText: {
    color: DARK,
    fontSize: 14,
    flex: 1,
  },

  inputLabel: {
    color: DARK,
    fontWeight: "700",
    marginBottom: 8,
  },

  phoneInput: {
    height: 58,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  countryCode: {
    fontSize: 16,
    fontWeight: "700",
    color: DARK,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },

  phoneField: {
    flex: 1,
    fontSize: 18,
    color: DARK,
    paddingLeft: 14,
  },

  helper: {
    color: MUTED,
    fontSize: 13,
    marginTop: 10,
  },

  otpInput: {
    height: 70,
    borderWidth: 1,
    borderColor: PURPLE,
    borderRadius: 16,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 10,
    textAlign: "center",
    color: DARK,
  },

  otpHint: {
    textAlign: "center",
    color: MUTED,
    marginTop: 12,
  },

  resend: {
    alignItems: "center",
    marginTop: 20,
  },

  resendText: {
    color: PURPLE,
    fontWeight: "800",
  },

  home: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  homeHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  homeGreeting: {
    color: DARK,
    fontSize: 28,
    fontWeight: "900",
  },

  homeId: {
    color: MUTED,
    fontSize: 12,
    marginTop: 3,
  },

  profile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },

  profileText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
  },

  searchBox: {
    margin: 20,
    marginBottom: 10,
    height: 52,
    backgroundColor: LIGHT,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  searchIcon: {
    fontSize: 25,
    color: MUTED,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: DARK,
  },

  chips: {
    paddingLeft: 20,
    maxHeight: 45,
  },

  chip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    marginRight: 8,
  },

  chipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },

  chipText: {
    color: MUTED,
    fontWeight: "700",
  },

  chipTextActive: {
    color: "#FFFFFF",
  },

  emptyArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#F0E9FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  emptyIconText: {
    color: PURPLE,
    fontSize: 36,
  },

  emptyTitle: {
    color: DARK,
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 8,
  },

  emptyText: {
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
  },

  startButton: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 13,
    backgroundColor: PURPLE,
    borderRadius: 13,
  },

  startButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  composeButton: {
    position: "absolute",
    right: 20,
    bottom: 75,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },

  composeText: {
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 34,
  },

  bottomNav: {
    height: 62,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
  },

  navActive: {
    color: PURPLE,
    fontWeight: "800",
  },

  navItem: {
    color: MUTED,
    fontWeight: "600",
  },
});