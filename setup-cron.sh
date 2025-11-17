#!/bin/bash

# Setup cron job for New Yorker scraper
# Runs 4 times daily: 6 AM, 12 PM, 6 PM, 12 AM

PROJECT_DIR="/Users/kavi/Sharedcodingprojects/BuenosDiasChile"
CRON_COMMAND="0 0,6,12,18 * * * cd $PROJECT_DIR && /usr/local/bin/npm run scrape:newyorker >> $PROJECT_DIR/logs/scraper.log 2>&1"

echo "Setting up cron job for New Yorker scraper..."
echo "Schedule: 4 times daily (12 AM, 6 AM, 12 PM, 6 PM)"
echo ""

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "scrape:newyorker"; then
    echo "⚠️  Cron job already exists. Removing old one..."
    crontab -l 2>/dev/null | grep -v "scrape:newyorker" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo "✅ Cron job installed successfully!"
echo ""
echo "Scraper will run at:"
echo "  - 12:00 AM (midnight)"
echo "  - 6:00 AM"
echo "  - 12:00 PM (noon)"
echo "  - 6:00 PM"
echo ""
echo "Logs will be saved to: $PROJECT_DIR/logs/scraper.log"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To remove this cron job: crontab -l | grep -v 'scrape:newyorker' | crontab -"
echo ""
echo "To test manually: npm run scrape:newyorker"
