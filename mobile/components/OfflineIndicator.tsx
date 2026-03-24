/**
 * OfflineIndicator - Visual indicator for offline status
 * Shows banner when offline and toast when back online
 */

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Wifi, WifiOff, RefreshCw, CloudOff, CheckCircle } from 'lucide-react-native';

import { useOffline } from '@/hooks/use-offline';

interface OfflineIndicatorProps {
  showOnlineToast?: boolean;
  position?: 'top' | 'bottom';
}

export function OfflineIndicator({
  showOnlineToast = true,
  position = 'top',
}: OfflineIndicatorProps) {
  const { isOffline, wasOffline, clearOfflineFlag, checkConnection } = useOffline();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  // Show "back online" toast
  useEffect(() => {
    if (wasOffline && !isOffline && showOnlineToast) {
      setShowBackOnline(true);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
        clearOfflineFlag();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOffline, showOnlineToast, clearOfflineFlag]);

  // Animate offline banner
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 0 : -100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, slideAnim]);

  // Don't render anything if online and not showing toast
  if (!isOffline && !showBackOnline) {
    return null;
  }

  // Back online toast
  if (showBackOnline && !isOffline) {
    return (
      <View style={[styles.backOnlineContainer, position === 'bottom' ? styles.bottom : styles.top]}>
        <View style={styles.backOnlineContent}>
          <CheckCircle size={18} color="#10B981" />
          <Text style={styles.backOnlineText}>Back online</Text>
        </View>
      </View>
    );
  }

  // Offline banner
  return (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' ? styles.bottom : styles.top,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftContent}>
          <WifiOff size={18} color="#FEF3C7" />
          <View style={styles.textContainer}>
            <Text style={styles.title}>You're offline</Text>
            <Text style={styles.subtitle}>Some features may be limited</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.retryButton} onPress={checkConnection}>
          <RefreshCw size={16} color="#FEF3C7" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/**
 * Compact offline badge for headers
 */
export function OfflineBadge() {
  const { isOffline, isOnline, checkConnection } = useOffline();
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = async () => {
    setIsChecking(true);
    await checkConnection();
    setIsChecking(false);
  };

  if (isOffline) {
    return (
      <TouchableOpacity style={styles.badgeOffline} onPress={handleCheck}>
        <WifiOff size={14} color="#FEF3C7" />
        <Text style={styles.badgeTextOffline}>Offline</Text>
      </TouchableOpacity>
    );
  }

  return null;
}

/**
 * Network status indicator (smaller)
 */
export function NetworkStatus() {
  const { isOffline, connectionType, isInternetReachable } = useOffline();

  if (isOffline) {
    return (
      <View style={styles.statusOffline}>
        <CloudOff size={12} color="#EF4444" />
        <Text style={styles.statusTextOffline}>No connection</Text>
      </View>
    );
  }

  if (isInternetReachable === false) {
    return (
      <View style={styles.statusLimited}>
        <Wifi size={12} color="#F59E0B" />
        <Text style={styles.statusTextLimited}>Limited</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 5,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 10,
  },
  title: {
    color: '#FEF3C7',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: '#FEE2E2',
    fontSize: 12,
    marginTop: 2,
  },
  retryButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(254, 243, 199, 0.1)',
  },
  // Back online styles
  backOnlineContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 5,
  },
  backOnlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOnlineText: {
    color: '#D1FAE5',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Badge styles
  badgeOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeTextOffline: {
    color: '#FEF3C7',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  // Status styles
  statusOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#FEE2E2',
  },
  statusTextOffline: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },
  statusLimited: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#FEF3C7',
  },
  statusTextLimited: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },
});
