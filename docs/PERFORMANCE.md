# Socket.IO Performance Tuning

This guide outlines OS-level configurations to optimize the Quick Chat server for high concurrency, based on the [official Socket.IO performance tuning guide](https://socket.io/docs/v4/performance-tuning/).

## Server Optimization

We have already implemented code-level optimizations:
- **Discard Initial HTTP Request**: The server automatically discards the reference to the initial HTTP request for each socket connection to save memory.

## OS Level Tuning

When scaling to thousands of concurrent users, you may hit Operating System limits.

### 1. Increase Maximum Open Files (File Descriptors)

If you cannot scale beyond ~1000 concurrent connections, you likely hit the file descriptor limit.

**Check current limit:**
```bash
ulimit -n
```

**Increase limit:**
Edit `/etc/security/limits.d/custom.conf` (requires root):
```conf
* soft nofile 1048576
* hard nofile 1048576
```
Then logout and login again.

### 2. Increase Available Local Ports

If you cannot scale beyond ~28,000 concurrent connections, you may be running out of ephemeral ports.

**Check current range:**
```bash
cat /proc/sys/net/ipv4/ip_local_port_range
```

**Increase range:**
Edit `/etc/sysctl.d/net.ipv4.ip_local_port_range.conf` (requires root):
```conf
net.ipv4.ip_local_port_range = 10000 65535
```
*Note: The lower bound (10000) prevents conflict with reserved system ports.*

Apply changes:
```bash
sysctl -p /etc/sysctl.d/net.ipv4.ip_local_port_range.conf
```
