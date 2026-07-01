(() => {
  const REACTION_SELECTOR = '.quick-reaction, .reaction-chip';
  let busy = new Set();

  function client() {
    try { if (typeof supabaseClient !== 'undefined') return supabaseClient; } catch {}
    return window.supabaseClient || window.rebusSupabaseClient || null;
  }

  function userId() {
    try { if (typeof currentUser !== 'undefined' && currentUser?.id) return currentUser.id; } catch {}
    return window.currentUser?.id || null;
  }

  async function refresh(messageId) {
    try {
      if (typeof refreshReactionForMessage === 'function') {
        await refreshReactionForMessage(messageId);
        return;
      }
    } catch (error) {
      console.warn('[REBUS] refreshReactionForMessage skipped:', error?.message || error);
    }
    document.dispatchEvent(new CustomEvent('rebus:reaction-changed', { detail: { messageId } }));
  }

  function closeMenus() {
    try { if (typeof closeMessageMenus === 'function') closeMessageMenus(); } catch {}
    try { if (typeof closeReactionPalettes === 'function') closeReactionPalettes(); } catch {}
  }

  async function setSingleReaction(messageId, reaction) {
    const supa = client();
    const uid = userId();
    if (!supa || !uid || !messageId || !reaction) return;

    const lockKey = `${messageId}:${uid}`;
    if (busy.has(lockKey)) return;
    busy.add(lockKey);

    try {
      const { data: existing, error: readError } = await supa
        .from('message_reactions')
        .select('reaction')
        .eq('message_id', messageId)
        .eq('user_id', uid);

      if (readError) throw readError;

      const alreadySame = (existing || []).some(row => row.reaction === reaction);

      const { error: deleteError } = await supa
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', uid);

      if (deleteError) throw deleteError;

      if (!alreadySame) {
        const { error: insertError } = await supa
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: uid, reaction });

        if (insertError) throw insertError;
      }

      await refresh(messageId);
    } catch (error) {
      console.warn('[REBUS] Single reaction update failed:', error?.message || error);
      alert(`Не вдалося оновити реакцію: ${error?.message || error}`);
    } finally {
      busy.delete(lockKey);
    }
  }

  async function handleReactionClick(event) {
    const button = event.target.closest?.(REACTION_SELECTOR);
    if (!button) return;
    const messageId = button.dataset.messageId;
    const reaction = button.dataset.reaction;
    if (!messageId || !reaction) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    await setSingleReaction(messageId, reaction);
    closeMenus();
  }

  document.addEventListener('click', handleReactionClick, true);

  window.RebusSingleReaction = {
    set: setSingleReaction
  };
})();
