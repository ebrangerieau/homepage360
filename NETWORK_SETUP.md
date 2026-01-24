# Homepage 360 - Network Monitoring Setup

## Quick Start

### 1. Generate API Key

```bash
openssl rand -hex 32
```

Copy the generated key - you'll need it for both VPS and local agent.

### 2. Deploy on VPS (Hostinger)

Update `docker-compose.yml` with your domain, then:

```bash
# Set the API key as environment variable
export MONITOR_API_KEY="your-generated-key-here"

# Build and start
docker-compose up -d --build
```

### 3. Deploy Agent on Local Server

1. Copy the `agent/` folder to your local server
2. Create `config.json` from the example:

```bash
cd agent
cp config.example.json config.json
```

3. Edit `config.json`:

```json
{
  "targets": [
    { "name": "Routeur", "host": "192.168.1.1" },
    { "name": "NAS", "host": "192.168.1.10" }
  ],
  "endpoint": "https://your-homepage360-domain.com/api/status",
  "apiKey": "your-generated-key-here",
  "intervalSeconds": 30
}
```

4. Start the agent:

```bash
docker-compose up -d --build
```

## Verify

- Check VPS API: `curl https://your-domain.com/api/status`
- Check agent logs: `docker logs homepage360-agent`
- Open Homepage360 in browser - you should see the "Réseau" zone with device statuses

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check API key matches on both sides |
| No devices shown | Verify agent is running and can reach VPS |
| Ping fails | Check network_mode is "host" in agent docker-compose |
