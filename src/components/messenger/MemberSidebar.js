import React, { useEffect, useState } from 'react';
import {
  Box, Typography, List, ListItem, ListItemAvatar, ListItemText,
  Avatar, Chip, CircularProgress, Divider,
} from '@mui/material';
import { listServerMembers } from '../../api/serversApi';

function avatarColor(username) {
  const colors = ['#1976d2','#388e3c','#d32f2f','#7b1fa2','#f57c00','#0288d1','#c2185b','#00796b'];
  let hash = 0;
  for (const c of (username || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function MemberSidebar({ serverId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) return;
    setLoading(true);
    listServerMembers({ serverId })
      .then((res) => setMembers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

  const owners  = members.filter((m) => m.isOwner);
  const regular = members.filter((m) => !m.isOwner);

  const MemberRow = ({ m }) => (
    <ListItem disableGutters sx={{ px: 1, py: 0.25 }}>
      <ListItemAvatar sx={{ minWidth: 36 }}>
        <Avatar
          src={m.avatarUrl || undefined}
          sx={{ width: 30, height: 30, fontSize: 12, bgcolor: avatarColor(m.username) }}
        >
          {!m.avatarUrl && m.displayName?.slice(0, 1).toUpperCase()}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={m.displayName}
        secondary={`@${m.username}`}
        primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
      />
      {m.muted && <Chip label="muted" size="small" sx={{ fontSize: 10, height: 18 }} />}
    </ListItem>
  );

  return (
    <Box sx={{
      width: 220, flexShrink: 0,
      bgcolor: 'grey.50',
      borderLeft: '1px solid', borderColor: 'divider',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Members — {members.length}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <List dense disablePadding sx={{ px: 0.5, py: 1 }}>
          {owners.length > 0 && (
            <>
              <Typography variant="caption" color="text.disabled" fontWeight={700}
                sx={{ px: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                Owner
              </Typography>
              {owners.map((m) => <MemberRow key={m.userId} m={m} />)}
              {regular.length > 0 && <Divider sx={{ my: 0.5 }} />}
            </>
          )}
          {regular.length > 0 && (
            <>
              <Typography variant="caption" color="text.disabled" fontWeight={700}
                sx={{ px: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                Members
              </Typography>
              {regular.map((m) => <MemberRow key={m.userId} m={m} />)}
            </>
          )}
        </List>
      )}
    </Box>
  );
}
