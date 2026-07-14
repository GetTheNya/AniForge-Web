import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../hooks/useNavigation';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import type { UserProfile } from '../types/supabase';

interface Friendship {
  sender_id: string;
  receiver_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  created_at?: string;
}

export default function SocialView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { addToast: showToast } = useToast();

  // Sync page title to document.title
  useEffect(() => {
    document.title = `${t('socialScreen.name', 'Social')} - AniForge Web`;
  }, [t]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [requestSubTab, setRequestSubTab] = useState<'received' | 'sent'>('received');

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, UserProfile>>(new Map());
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch friendships and profiles
  const loadSocialData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      // 1. Fetch friendships
      const { data: rawFriendships, error: fError } = await supabase
        .from('friendships')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (fError) throw fError;

      const list = (rawFriendships || []) as Friendship[];
      setFriendships(list);

      // 2. Extract profile IDs to fetch
      const profileIds = Array.from(
        new Set(
          list.map((f) => (f.sender_id === user.id ? f.receiver_id : f.sender_id))
        )
      );

      if (profileIds.length > 0) {
        const { data: rawProfiles, error: pError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', profileIds);

        if (pError) throw pError;

        const map = new Map<string, UserProfile>();
        (rawProfiles || []).forEach((p) => {
          map.set(p.id, p as UserProfile);
        });
        setProfilesMap(map);
      } else {
        setProfilesMap(new Map());
      }
    } catch (err: any) {
      console.error('[social] Error loading social data:', err);
      showToast(t('socialScreen.toastError', { error: err.message || err }), 'error');
    } finally {
      setIsLoadingData(false);
    }
  }, [user, showToast, t]);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  // Handle User Search
  const handleSearch = useCallback(async (query: string) => {
    if (!user) return;
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .limit(20);

      if (error) throw error;
      setSearchResults((data || []) as UserProfile[]);
    } catch (err: any) {
      console.error('[social] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, handleSearch]);

  // Social Actions
  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    setActionLoadingId(receiverId);
    try {
      const { error } = await supabase
        .from('friendships')
        .insert({ receiver_id: receiverId });
      if (error) throw error;
      showToast(t('socialScreen.toastRequestSent'), 'success');
      await loadSocialData();
    } catch (err: any) {
      showToast(t('socialScreen.toastError', { error: err.message }), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const acceptRequest = async (senderId: string) => {
    if (!user) return;
    setActionLoadingId(senderId);
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'ACCEPTED' })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id);
      if (error) throw error;
      showToast(t('socialScreen.toastRequestAccepted'), 'success');
      await loadSocialData();
    } catch (err: any) {
      showToast(t('socialScreen.toastError', { error: err.message }), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const removeFriendship = async (friendId: string) => {
    if (!user) return;
    setActionLoadingId(friendId);
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`);
      if (error) throw error;
      showToast(t('socialScreen.toastFriendRemoved'), 'success');
      await loadSocialData();
    } catch (err: any) {
      showToast(t('socialScreen.toastError', { error: err.message }), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Derive Lists
  const friendsList = friendships
    .filter((f) => f.status === 'ACCEPTED')
    .map((f) => profilesMap.get(f.sender_id === user?.id ? f.receiver_id : f.sender_id))
    .filter(Boolean) as UserProfile[];

  const receivedRequests = friendships
    .filter((f) => f.status === 'PENDING' && f.receiver_id === user?.id)
    .map((f) => profilesMap.get(f.sender_id))
    .filter(Boolean) as UserProfile[];

  const sentRequests = friendships
    .filter((f) => f.status === 'PENDING' && f.sender_id === user?.id)
    .map((f) => profilesMap.get(f.receiver_id))
    .filter(Boolean) as UserProfile[];

  const getFriendshipState = (targetId: string) => {
    const rel = friendships.find(
      (f) =>
        (f.sender_id === user?.id && f.receiver_id === targetId) ||
        (f.sender_id === targetId && f.receiver_id === user?.id)
    );
    if (!rel) return null;
    return rel;
  };

  const renderUserAvatar = (profile: UserProfile, sizeClasses = 'w-10 h-10 text-sm') => {
    return (
      <div className={`rounded-full flex items-center justify-center overflow-hidden border border-[var(--color-border-glass)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] font-bold select-none shrink-0 shadow-sm ${sizeClasses}`}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
        ) : (
          <span>{(profile.username || 'U')[0].toUpperCase()}</span>
        )}
      </div>
    );
  };

  const renderActionButtons = (friend: UserProfile) => {
    const rel = getFriendshipState(friend.id);
    const isLoading = actionLoadingId === friend.id;

    if (isLoading) {
      return (
        <div className="w-6 h-6 border-2 border-[var(--color-text-secondary)] border-t-transparent rounded-full animate-spin" />
      );
    }

    if (!rel) {
      return (
        <button
          onClick={() => sendRequest(friend.id)}
          className="glass-badge py-1.5 px-3 bg-[var(--color-accent-primary)]/10 border-[var(--color-accent-primary)] text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)] hover:text-white transition-all cursor-pointer text-xs font-semibold"
        >
          ➕ {t('socialScreen.addFriend')}
        </button>
      );
    }

    if (rel.status === 'ACCEPTED') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/shared-profile', `?id=${friend.id}`)}
            className="glass-badge py-1.5 px-3 bg-[var(--color-bg-input)] border-[var(--color-border-glass)] text-[var(--color-text-primary)] hover:border-white transition-all cursor-pointer text-xs"
          >
            👤 {t('socialScreen.viewDetails')}
          </button>
          <button
            onClick={() => removeFriendship(friend.id)}
            className="glass-badge py-1.5 px-3 bg-[var(--color-bg-input)] border-[var(--color-border-glass)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-rose)]/40 hover:text-[var(--color-accent-rose)] transition-all cursor-pointer text-xs"
          >
            🗑️ {t('socialScreen.removeFriend')}
          </button>
        </div>
      );
    }

    if (rel.status === 'PENDING') {
      if (rel.receiver_id === user?.id) {
        return (
          <div className="flex gap-2">
            <button
              onClick={() => acceptRequest(friend.id)}
              className="glass-badge py-1.5 px-3 bg-[var(--color-accent-emerald)]/10 border-[var(--color-accent-emerald)] text-[var(--color-accent-emerald)] hover:bg-[var(--color-accent-emerald)] hover:text-white transition-all cursor-pointer text-xs font-semibold"
            >
              ✓ {t('socialScreen.accept')}
            </button>
            <button
              onClick={() => removeFriendship(friend.id)}
              className="glass-badge py-1.5 px-3 bg-[var(--color-accent-rose)]/10 border-[var(--color-accent-rose)] text-[var(--color-accent-rose)] hover:bg-[var(--color-accent-rose)] hover:text-white transition-all cursor-pointer text-xs font-semibold"
            >
              ✕ {t('socialScreen.decline')}
            </button>
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-tertiary)] italic">{t('socialScreen.pending')}</span>
            <button
              onClick={() => removeFriendship(friend.id)}
              className="glass-badge py-1 px-2.5 bg-[var(--color-bg-input)] border-[var(--color-border-glass)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-rose)]/40 hover:text-[var(--color-accent-rose)] transition-all cursor-pointer text-xs"
            >
              {t('socialScreen.cancelRequest')}
            </button>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black text-[var(--color-text-primary)]">
          {t('socialScreen.name')}
        </h2>
      </div>

      {/* User Search Panel */}
      <div className="glass-card p-4 relative overflow-hidden backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('socialScreen.searchPlaceholder')}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] placeholder-[var(--color-text-tertiary)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-2.5 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white transition-all cursor-pointer text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border-glass)] space-y-3">
            {isSearching ? (
              <div className="text-center py-4 text-xs text-[var(--color-text-secondary)]">
                {t('common.loading')}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-4 text-xs text-[var(--color-text-secondary)]">
                {t('common.noResults')}
              </div>
            ) : (
              searchResults.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-[var(--color-border-glass)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    {renderUserAvatar(friend)}
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {friend.username}
                    </span>
                  </div>
                  {renderActionButtons(friend)}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Navigation tabs */}
      {!searchQuery.trim() && (
        <div className="space-y-4">
          {/* Main Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'friends'
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] shadow-[0_0_12px_rgba(var(--color-accent-primary-rgb),0.25)]'
                  : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
              }`}
            >
              👥 {t('socialScreen.tabFriends')} ({friendsList.length})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'requests'
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] shadow-[0_0_12px_rgba(var(--color-accent-primary-rgb),0.25)]'
                  : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white'
              }`}
            >
              ✉️ {t('socialScreen.tabRequests')} ({receivedRequests.length + sentRequests.length})
            </button>
          </div>

          {/* Sub-tabs under requests */}
          {activeTab === 'requests' && (
            <div className="flex gap-2">
              <button
                onClick={() => setRequestSubTab('received')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                  requestSubTab === 'received'
                    ? 'border-[var(--color-border-glass-hover)] bg-[var(--color-bg-input)] text-white'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'
                }`}
              >
                📥 {t('socialScreen.tabRequestsReceived')} ({receivedRequests.length})
              </button>
              <button
                onClick={() => setRequestSubTab('sent')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                  requestSubTab === 'sent'
                    ? 'border-[var(--color-border-glass-hover)] bg-[var(--color-bg-input)] text-white'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'
                }`}
              >
                📤 {t('socialScreen.tabRequestsSent')} ({sentRequests.length})
              </button>
            </div>
          )}

          {/* Tab lists */}
          <div className="glass-card p-5 min-h-[150px] relative backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)] flex flex-col gap-3">
            {isLoadingData ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-text-secondary)] animate-pulse">
                {t('common.loading')}
              </div>
            ) : activeTab === 'friends' ? (
              friendsList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-tertiary)] py-8">
                  {t('socialScreen.noFriends')}
                </div>
              ) : (
                friendsList.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] border border-[var(--color-border-glass)]/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {renderUserAvatar(friend)}
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {friend.username}
                      </span>
                    </div>
                    {renderActionButtons(friend)}
                  </div>
                ))
              )
            ) : requestSubTab === 'received' ? (
              receivedRequests.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-tertiary)] py-8">
                  {t('socialScreen.noRequests')}
                </div>
              ) : (
                receivedRequests.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] border border-[var(--color-border-glass)]/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {renderUserAvatar(friend)}
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {friend.username}
                      </span>
                    </div>
                    {renderActionButtons(friend)}
                  </div>
                ))
              )
            ) : sentRequests.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-tertiary)] py-8">
                {t('socialScreen.noRequests')}
              </div>
            ) : (
              sentRequests.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] border border-[var(--color-border-glass)]/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {renderUserAvatar(friend)}
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {friend.username}
                    </span>
                  </div>
                  {renderActionButtons(friend)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
