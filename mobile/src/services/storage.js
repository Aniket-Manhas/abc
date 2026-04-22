import AsyncStorage from '@react-native-async-storage/async-storage';

const storage = {
  getItem: async (key) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch { return null; }
  },
  setItem: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch {}
  },
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

export default storage;
