# Deployment Guide: Portalbot on AWS with HTTPS

This guide walks you through deploying Portalbot to your AWS EC2 instance with HTTPS enabled using Let's Encrypt.

## Table of Contents

1. [DNS Configuration](#1-dns-configuration)
2. [AWS Security Group](#2-aws-security-group)
3. [Server Setup](#3-server-setup)
4. [Install Dependencies](#4-install-dependencies)
5. [Configure Nginx](#5-configure-nginx)
6. [Get SSL Certificate](#6-get-ssl-certificate)
7. [Set Up Systemd Service](#7-set-up-systemd-service)
8. [Verification](#8-verification)
9. [Troubleshooting](#9-troubleshooting)

## 1. DNS Configuration

### Configure DNS in IONOS

1. **Log in to IONOS** (https://www.ionos.com)
2. Go to **Domains** → Click on `portalbot.net`
3. Click **DNS Settings** or **Manage DNS**

4. **Add A Record for root domain:**
   ```
   Type: A
   Host: @  (or leave blank for root domain)
   Points to: 3.134.87.34
   TTL: 3600 (or default)
   ```

5. **Add A Record for www subdomain (optional):**
   ```
   Type: A
   Host: www
   Points to: 3.134.87.34
   TTL: 3600
   ```

6. **Save changes**

### Verify DNS Propagation

Wait 5-15 minutes, then test:

```bash
# Check from your local machine
nslookup portalbot.net
dig portalbot.net

# Or use online tool: https://www.whatsmydns.net/
```

You should see: `3.134.87.34`

---

## 2. AWS Security Group

### Update EC2 Security Group Rules

1. **Go to AWS EC2 Console:** https://console.aws.amazon.com/ec2/
2. Click **Instances** → Select your instance
3. Click **Security** tab → Click the **Security group** link
4. Click **Edit inbound rules** → **Add rules**

Add these rules:

| Type       | Protocol | Port Range    | Source    | Description              |
|------------|----------|---------------|-----------|--------------------------|
| HTTP       | TCP      | 80            | 0.0.0.0/0 | HTTP access              |
| HTTPS      | TCP      | 443           | 0.0.0.0/0 | HTTPS access             |
| SSH        | TCP      | 22            | 0.0.0.0/0 | SSH developer access     |
| Custom TCP | TCP      | 5349          | 0.0.0.0/0 | STUN/TURN server         |
| Custom UDP | UDP      | 5349          | 0.0.0.0/0 | STUN/TURN server         |
| Custom TCP | TCP      | 32355 - 65535 | 0.0.0.0/0 | TURN ephemeral ports     |
| Custom UDP | UDP      | 32355 - 65535 | 0.0.0.0/0 | TURN ephemeral ports     |
| Custom TCP | TCP      | 3478 - 3479   | 0.0.0.0/0 | STUN/TURN server         |
| Custom UDP | UDP      | 3478 - 3479   | 0.0.0.0/0 | STUN/TURN server         |

5. Click **Save rules**

---

## 3. Server Setup

### Connect to Your EC2 Instance

```bash
ssh -i your-key.pem ubuntu@3.134.87.34
# Or if using user 'bee':
ssh bee@3.134.87.34
```

### Update System

```bash
sudo apt update
sudo apt upgrade -y
```

---

## 4. Install Dependencies

### Install Nginx and Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Verify Nginx is Running

```bash
sudo systemctl status nginx
```

You should see "active (running)". If not:

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

Test by visiting: `http://3.134.87.34` - you should see the Nginx welcome page.

---

## 5. Configure Nginx

### Upload Nginx Configuration

From your **local machine** (where the repo is), upload the nginx config:

```bash
scp nginx.conf bee@3.134.87.34:/tmp/portalbot.conf
```

### Install Nginx Configuration

On the **EC2 server**:

```bash
# Copy to nginx sites-available
sudo cp /tmp/portalbot.conf /etc/nginx/sites-available/portalbot

# Create symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/portalbot /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t
```

You should see:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Reload Nginx

```bash
sudo systemctl reload nginx
```

---

## 6. Get SSL Certificate

### Run Certbot

```bash
sudo certbot --nginx -d portalbot.net -d www.portalbot.net
```

**Follow the prompts:**

1. **Enter email address:** (for renewal notifications)
2. **Agree to Terms of Service:** Yes
3. **Share email with EFF:** Your choice (No is fine)
4. **Redirect HTTP to HTTPS:** Choose **2** (Yes, redirect)

Certbot will:
- ✅ Verify domain ownership (via HTTP challenge on port 80)
- ✅ Generate SSL certificate
- ✅ Modify nginx config to use HTTPS
- ✅ Set up auto-renewal

You should see:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/portalbot.net/fullchain.pem
...
Deploying certificate
Successfully deployed certificate for portalbot.net to /etc/nginx/sites-enabled/portalbot
Congratulations! You have successfully enabled HTTPS on https://portalbot.net
```

### Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
```

Should complete successfully.

### Check Renewal Timer

```bash
sudo systemctl status certbot.timer
```

Should show "active (waiting)".

---

## 7. Set Up Systemd Service

This ensures your Flask app starts automatically on boot and restarts if it crashes.

### Upload Service File

From your **local machine**:

```bash
scp portalbot.service bee@3.134.87.34:/tmp/
```

### Install Service File

On the **EC2 server**:

```bash
# Copy to systemd directory
sudo cp /tmp/portalbot.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable portalbot

# Start the service
sudo systemctl start portalbot

# Check status
sudo systemctl status portalbot
```

You should see "active (running)".

### View Logs

```bash
# View recent logs
sudo journalctl -u portalbot -n 50 --no-pager

# Follow logs in real-time
sudo journalctl -u portalbot -f
```

### Service Management Commands

```bash
# Start service
sudo systemctl start portalbot

# Stop service
sudo systemctl stop portalbot

# Restart service
sudo systemctl restart portalbot

# Check status
sudo systemctl status portalbot

# View logs
sudo journalctl -u portalbot -f
```

---

## 8. Verification

### Test HTTPS Access

1. **Open browser** and navigate to:
   ```
   https://portalbot.net
   ```

2. **You should see:**
   - ✅ Padlock icon in address bar (secure connection)
   - ✅ Portalbot interface loads
   - ✅ No certificate warnings

3. **Test WebRTC:**
   - Click "Join Space"
   - Enter a space name (e.g., "test")
   - **Browser should prompt for camera/microphone access** ← This is the key test!
   - Allow access
   - You should see your local video

4. **Test Peer Connection:**
   - Open another browser window/tab (or different device)
   - Go to `https://portalbot.net`
   - Enter the **same space name**
   - Both peers should connect and see each other's video

### Verify SSL Certificate

```bash
# Check certificate details
sudo certbot certificates
```

Should show:
```
Certificate Name: portalbot.net
  Domains: portalbot.net www.portalbot.net
  Expiry Date: [90 days from now]
  Certificate Path: /etc/letsencrypt/live/portalbot.net/fullchain.pem
```

### Test from Different Networks

- Test from your home network
- Test from mobile network (phone with WiFi off)
- Both should work (this proves TURN server is working for restrictive firewalls)

---

## 9. Troubleshooting

### Issue: DNS Not Resolving

**Symptom:** `nslookup portalbot.net` doesn't return `3.134.87.34`

**Solution:**
- Wait longer (DNS can take up to 24 hours, usually 15 minutes)
- Check DNS configuration in IONOS
- Use https://www.whatsmydns.net/ to check global propagation

### Issue: Certbot Fails with "Connection Refused"

**Symptom:** Certbot can't verify domain ownership

**Possible causes:**
1. DNS not propagated yet → Wait and retry
2. Port 80 not open → Check AWS Security Group
3. Nginx not running → `sudo systemctl start nginx`

**Solution:**
```bash
# Check nginx is running
sudo systemctl status nginx

# Check port 80 is open
sudo netstat -tlnp | grep :80

# Test nginx responds
curl http://portalbot.net
```

### Issue: Camera/Microphone Still Not Prompting

**Symptom:** No camera prompt even over HTTPS

**Checks:**
1. Verify you're accessing via `https://` not `http://`
2. Check browser console for errors (F12 → Console)
3. Check browser is in secure context:
   ```javascript
   console.log(window.isSecureContext);  // Should be true
   console.log(navigator.mediaDevices);   // Should be defined
   ```

### Issue: Service Won't Start

**Symptom:** `sudo systemctl status portalbot` shows "failed"

**Solution:**
```bash
# Check logs for errors
sudo journalctl -u portalbot -n 50

# Common issues:
# 1. Wrong Python path - check: /home/bee/pyenv/wv/bin/python exists
# 2. Wrong working directory - check: /home/bee/portalbot exists
# 3. Port already in use - check: sudo netstat -tlnp | grep 5080
```

### Issue: WebRTC Connection Fails

**Symptom:** Can't see remote video, connection stuck on "Connecting..."

**Checks:**
1. Open browser console (F12) → Check for errors
2. Check "Connection Info" section in the UI
3. Verify TURN server is accessible:
   ```bash
   # Test from EC2 server
   nc -zv your_aws_instance.compute.amazonaws.com 3478
   ```


### Restart Everything

If all else fails:

```bash
# Restart Flask app
sudo systemctl restart portalbot

# Restart Nginx
sudo systemctl restart nginx

# Check both are running
sudo systemctl status portalbot
sudo systemctl status nginx
```

---

## Updating the Application

When you make changes to the code:

### 1. Update Files on Server

From your **local machine**:

```bash
./upload.sh your_aws_instance.compute.amazonaws.com
```

### 2. Restart Service

On the **EC2 server**:

```bash
sudo systemctl restart portalbot
```

### 3. Verify Changes

Check logs:
```bash
sudo journalctl -u portalbot -f
```

Test in browser (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)

---

## Security Recommendations

### 1. Update SECRET_KEY

Edit `.env` on the server:

```bash
nano /home/bee/portalbot/.env
```

Set a strong random secret:
```
SECRET_KEY=your-very-long-random-secret-key-here
```

Generate one with:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```


## Monitoring

### View Real-Time Logs

```bash
# FastAPI app logs
sudo journalctl -u portalbot -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Check Resource Usage

```bash
# CPU and memory
htop

# Disk space
df -h

# Service status
sudo systemctl status portalbot nginx
```
