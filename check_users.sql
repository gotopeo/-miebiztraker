SELECT u.id, u.name, u.email, u.role, 
       lc.lineUserId, lc.lineDisplayName,
       COUNT(ns.id) as notification_count
FROM users u
LEFT JOIN line_connections lc ON u.id = lc.userId
LEFT JOIN notification_subscriptions ns ON u.id = ns.userId
GROUP BY u.id, u.name, u.email, u.role, lc.lineUserId, lc.lineDisplayName
ORDER BY u.id;
