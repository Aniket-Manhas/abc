import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, Linking,
} from 'react-native';
import BookingModal from '../components/BookingModal';
import { colors, spacing, radius } from '../theme';

const AVAIL_COLOR = { high: '#27ae60', medium: '#e67e22', low: '#e74c3c' };
const AVAIL_LABEL = { high: 'Available', medium: 'Limited', low: 'Pre-book' };

const VEHICLES = [
  { id:'prepaid_taxi',  category:'Taxi & Cab',   emoji:'🚖', name:'Pre-paid Taxi',        provider:'Official counter',         fare:'₹40 base + ₹12/km', eta:'2–5 min',       availability:'high',   color:'#e8a020', features:['Meter sealed','Receipt issued','Fixed fares'] },
  { id:'ola',           category:'App Cab',       emoji:'🚗', name:'Ola Cab',              provider:'Ola • App-based',          fare:'₹45 base + surge',  eta:'4–10 min',      availability:'high',   color:'#22c55e', appLink:'https://www.olacabs.com', features:['Track ride','AC available'] },
  { id:'uber',          category:'App Cab',       emoji:'🚙', name:'Uber',                 provider:'Uber • App-based',         fare:'₹50 base + surge',  eta:'5–12 min',      availability:'medium', color:'#000',    appLink:'https://www.uber.com', features:['GPS tracked','Share fare'] },
  { id:'e_rickshaw',    category:'Eco Transport', emoji:'🛺', name:'E-Rickshaw',           provider:'Local operators',          fare:'₹20–40 fixed',      eta:'1–3 min',       availability:'high',   color:'#27ae60', features:['Eco-friendly','Short distances'] },
  { id:'cycle_rickshaw',category:'Eco Transport', emoji:'🚲', name:'Cycle Rickshaw',       provider:'Local operators',          fare:'₹15–25',            eta:'1–2 min',       availability:'high',   color:'#84cc16', features:['Zero emission','Last 1–2 km only'] },
  { id:'shared_tempo',  category:'Shared',        emoji:'🚐', name:'Shared Tempo / Vikram',provider:'City route service',       fare:'₹10–20 per seat',   eta:'5–10 min',      availability:'medium', color:'#e67e22', features:['Fixed city routes','Very economical'] },
  { id:'city_bus',      category:'Shared',        emoji:'🚌', name:'JKRTC City Bus',       provider:'J&K Road Transport Corp.',fare:'₹8–15',             eta:'10–20 min',     availability:'medium', color:'#3b82f6', features:['Air cooled','Senior concession'] },
  { id:'mini_bus',      category:'Shared',        emoji:'🚎', name:'Mini Bus / Maxicab',   provider:'Private operators',        fare:'₹15–30',            eta:'5–15 min',      availability:'medium', color:'#8b5cf6', features:['City + intercity'] },
  { id:'airport_taxi',  category:'Airport',       emoji:'✈️', name:'Airport Shuttle',      provider:'Srinagar & Jammu Airport', fare:'₹350–600 fixed',    eta:'Scheduled',     availability:'low',    color:'#06b6d4', features:['Luggage space','Pre-book recommended'] },
  { id:'irctc_taxi',    category:'Premium',       emoji:'🏷️', name:'IRCTC Taxi Service',   provider:'Indian Railways Tourism',  fare:'₹60 base + ₹15/km',eta:'3–8 min',       availability:'medium', color:'#dc2626', appLink:'https://www.irctctourism.com', features:['Pan-India booking'] },
  { id:'heritage_cab',  category:'Tourism',       emoji:'🗺️', name:'Heritage Cab (Jammu)', provider:'J&K Tourism Dept.',        fare:'₹200/hr, min 2 hrs',eta:'On booking',    availability:'low',    color:'#f59e0b', features:['English-speaking guide','AC vehicle'] },
  { id:'vaishno_bus',   category:'Tourism',       emoji:'🏔️', name:'Katra / Vaishno Devi', provider:'SRTC + Private',          fare:'₹80–120',           eta:'Fixed schedule', availability:'high',   color:'#a855f7', features:['Direct to Katra','Frequent departures'] },
];

const CATEGORIES = ['All', 'Taxi & Cab', 'App Cab', 'Eco Transport', 'Shared', 'Premium', 'Airport', 'Tourism'];

function VehicleCard({ vehicle: v, onBook }) {
  return (
    <TouchableOpacity style={[styles.vCard, { borderLeftColor: v.color }]} onPress={onBook} activeOpacity={0.8}>
      <View style={[styles.vIcon, { backgroundColor: `${v.color}18`, borderColor: `${v.color}35` }]}>
        <Text style={{ fontSize: 22 }}>{v.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.vRow}>
          <Text style={styles.vName}>{v.name}</Text>
          <View style={[styles.availBadge, { backgroundColor: `${AVAIL_COLOR[v.availability]}18`, borderColor: `${AVAIL_COLOR[v.availability]}30` }]}>
            <Text style={[styles.availText, { color: AVAIL_COLOR[v.availability] }]}>{AVAIL_LABEL[v.availability]}</Text>
          </View>
        </View>
        <Text style={styles.vProvider}>{v.provider}</Text>
        <View style={styles.vMetaRow}>
          <Text style={styles.vFare}>{v.fare}</Text>
          <Text style={styles.vEta}>⏱ {v.eta}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LastMileScreen() {
  const [category, setCategory] = useState('All');
  const [search, setSearch]     = useState('');
  const [booking, setBooking]   = useState(null);

  const filtered = VEHICLES.filter(v => {
    const matchCat    = category === 'All' || v.category === category;
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.provider.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const stats = [
    { icon: '🚗', label: 'Total Options',  value: VEHICLES.length },
    { icon: '✅', label: 'Available Now',  value: VEHICLES.filter(v => v.availability === 'high').length },
    { icon: '🌿', label: 'Eco-Friendly',   value: VEHICLES.filter(v => v.category === 'Eco Transport').length },
    { icon: '📱', label: 'App-Based',      value: VEHICLES.filter(v => v.appLink).length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <FlatList
        data={filtered}
        keyExtractor={v => v.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.screenTitle}>🚕 Last Mile Connectivity</Text>
            <Text style={styles.screenSub}>Transport options from Jammu Tawi Railway Station</Text>

            {/* Stats */}
            <View style={styles.statsRow}>
              {stats.map(s => (
                <View key={s.label} style={styles.statCard}>
                  <Text style={{ fontSize: 18 }}>{s.icon}</Text>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Search */}
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Search transport…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catChip, category === c && styles.catChipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        }
        renderItem={({ item }) => (
          <VehicleCard vehicle={item} onBook={() => setBooking(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 30 }}>🔍</Text>
            <Text style={styles.emptyText}>No transport found for "{search}"</Text>
          </View>
        }
      />

      {booking && (
        <BookingModal vehicle={booking} onClose={() => setBooking(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: 40 },
  screenTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  screenSub:   { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },

  statsRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard:  { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.accentSaffron, marginTop: 2 },
  statLabel: { fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 1 },

  searchInput: {
    backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, color: colors.textPrimary, fontSize: 14,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, marginBottom: spacing.sm,
  },

  catChip:         { backgroundColor: colors.bgElevated, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  catChipActive:   { backgroundColor: colors.accentSaffron, borderColor: colors.accentSaffron },
  catChipText:     { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  catChipTextActive:{ color: colors.bgPrimary },

  vCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3 },
  vIcon:  { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  vRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  vName:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  vProvider:{ fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  vMetaRow: { flexDirection: 'row', gap: spacing.md },
  vFare:    { fontSize: 12, fontWeight: '700', color: colors.accentSaffron, fontFamily: 'monospace' },
  vEta:     { fontSize: 12, color: colors.textMuted, fontFamily: 'monospace' },

  availBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  availText:  { fontSize: 10, fontWeight: '700' },

  empty:     { alignItems: 'center', paddingTop: 40, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
