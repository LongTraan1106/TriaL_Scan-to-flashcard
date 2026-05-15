/**
 * Search Group Screen
 * Tìm kiếm groups của user hoặc public groups
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useGroup } from '../contexts/GroupContext';
import { Group } from '../types/group';
import { formatMemberCount } from '../utils/groupPermissionHelpers';
import { GroupDetailModal } from '../components/GroupDetailModal';

type FilterType = 'my' | 'public';

function SearchGroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { 
    groups, 
    searchResults, 
    isFetchingGroups,
    isSearchingGroups,
    error, 
    getGroups, 
    searchPublicGroups,
    clearSearchResults,
    clearError 
  } = useGroup();
  
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<FilterType>('my');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      getGroups();
    }, [getGroups])
  );

  // Handle error
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    if (filter !== 'public') {
      return;
    }

    const query = searchText.trim();
    if (!query) {
      clearSearchResults();
      return;
    }

    const timer = setTimeout(() => {
      searchPublicGroups(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText, filter, searchPublicGroups, clearSearchResults]);

  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  const getDisplayResults = (): Group[] => {
    if (filter === 'my') {
      if (!searchText.trim()) {
        return groups;
      }
      return groups.filter((g) =>
        g.name.toLowerCase().includes(searchText.toLowerCase())
      );
    } else {
      return searchResults;
    }
  };

  const handleGroupPress = (group: Group) => {
    setSelectedGroup(group);
    setShowDetailModal(true);
  };

  const renderGroupCard = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => handleGroupPress(item)}
    >
      <View style={styles.groupCardContent}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.memberCount}>
          {formatMemberCount(item.member_count)}
        </Text>
      </View>
      {filter === 'public' && (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => handleGroupPress(item)}
        >
          <Text style={styles.joinButtonText}>Detail</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {searchText ? 'No groups found' : 'No results'}
      </Text>
      {searchText && filter === 'public' && (
        <Text style={styles.emptySubText}>
          Try searching with different keywords
        </Text>
      )}
    </View>
  );

  const displayResults = getDisplayResults();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Groups</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={filter === 'my' ? 'Search my groups...' : 'Search public groups...'}
          placeholderTextColor="#A0B0A0"
          value={searchText}
          onChangeText={handleSearch}
          selectionColor="#8B9D8A"
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'my' ? styles.filterTabActive : null,
          ]}
          onPress={() => {
            setFilter('my');
            setSearchText('');
            clearSearchResults();
          }}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'my' ? styles.filterTabTextActive : null,
            ]}
          >
            My Groups
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'public' ? styles.filterTabActive : null,
          ]}
          onPress={() => {
            setFilter('public');
            setSearchText('');
            clearSearchResults();
          }}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'public' ? styles.filterTabTextActive : null,
            ]}
          >
            Public Groups
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results List */}
      {(filter === 'my' ? isFetchingGroups : isSearchingGroups) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B9D8A" />
        </View>
      ) : (
        <FlatList
          data={displayResults}
          renderItem={renderGroupCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Group Detail Modal */}
      <GroupDetailModal
        visible={showDetailModal}
        group={selectedGroup}
        onClose={() => setShowDetailModal(false)}
        onDataUpdated={() => {
          getGroups();
          setShowDetailModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F0',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#8B9D8A',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 34,
  },
  // Search Bar
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2D3C2C',
    borderWidth: 1,
    borderColor: '#D0DCC8',
  },
  // Filter Tabs
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#C5D8C0',
    borderWidth: 2,
    borderColor: '#C5D8C0',
  },
  filterTabActive: {
    backgroundColor: '#8B9D8A',
    borderColor: '#8B9D8A',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A6B56',
    textAlign: 'center',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  // Results List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#AEC3B0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupCardContent: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3C2C',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5A6B56',
  },
  joinButton: {
    backgroundColor: '#8B9D8A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  joinButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3C2C',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5A6B56',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SearchGroupScreen;
