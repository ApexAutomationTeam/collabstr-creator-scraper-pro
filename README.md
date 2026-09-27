# collabstr-creator-scraper-pro
High-performance Collabstr influencer &amp; UGC creator scraper with multi-page memory persistence, deep profile extraction, and 28-column Excel exports. By Apex Automation Team.


# 🚀 Collabstr Creator & Influencer Scraper Pro (v3.5)

> 💡 **Community Project**: This automation tool is open-sourced and provided for free as part of the public tools catalog by **[Apex Automation Team](https://apexautomationteam.com/)**. Visit our website for custom influencer scrapers, marketing automations, and AI data pipelines.

A high-performance in-browser automation tool specifically engineered to extract creator and UGC influencer datasets from **Collabstr** with zero API keys or external tools required.

---

## ⚡ Multi-Page Memory Persistence (How It Works)

* **40 Creators Per Page**: Collabstr displays 40 creator cards per page. This script runs directly in your browser and scrapes up to 40 creators per execution.
* **Persistent Local Memory**: When a page run completes, data is automatically saved to your browser's local memory (`localStorage`).
* **Navigate & Scrape Sequentially**: You can browse from page to page (Page 1 → Page 2 → Page 3) and run the script on each page.
* **Download All At Once**: When you are finished browsing, click **📦 Download ALL** in the on-screen panel or run `window.downloadAllCollabstr()` in the console to export every accumulated creator across all scraped pages into a single consolidated `.xlsx` spreadsheet.

---

## 📺 Demonstration Video & Verified Behavior

To verify how this script operates and review its live interface:

* 📥 **[Watch / Download Demo Video from Official Release](https://github.com/ApexAutomationTeam/collabstr-creator-scraper-pro/releases/tag/v3.4.6)**
* 📦 **[View Release Assets v1.0.0](https://github.com/ApexAutomationTeam/collabstr-creator-scraper-pro/releases/tag/v3.4.6)**

---

## ⚠️ Platform Changes, Maintenance & Support

> **Notice Regarding DOM Structure Updates**:  
> Web platforms like Collabstr routinely update their layout classes, frontend components, and markup. If Collabstr deploys breaking frontend updates and certain columns stop populating:
> 
> * **Community Patches**: Any developer is welcome to inspect the DOM, update selectors in `parseCard()` or `extractPlatformFollowers()`, and submit a Pull Request.
> * **Direct Support & Upgrades**: If you encounter bugs or need updated selectors, reach out directly to our engineering team at:  
>   📧 **contact@apexautomationteam.com**  
>   We will patch the codebase and publish an updated build immediately.

---

## 🛠️ How to Use (Step-by-Step)

### 1. Open Collabstr Search
1. Open Google Chrome and go to any listing or search results page on [Collabstr](https://collabstr.com/) (e.g., filtered by location, niche, or platform).

### 2. Launch DevTools Console
1. Press **`F12`** (or right-click anywhere on the page and select **Inspect**).
2. Switch to the **Console** tab.
3. If Chrome prompts security instructions, type `allow pasting` and press **Enter**.

### 3. Run the Scraper
1. Copy the entire code from `Collabstr_Creator_Scraper_v3_5.js`.
2. Paste it into the Console and press **Enter**.
3. A dark-themed HUD overlay will appear at the bottom-right corner showing live progress, card scans, and profile enrichment status.
4. An individual Excel workbook (`.xlsx`) will download automatically once the page is scraped.

### 4. Process Multiple Pages & Consolidate
1. Navigate to the next page on Collabstr.
2. Paste the script and hit Enter again.
3. When ready, click **📦 Download ALL** from the popup HUD to download all collected creators in a single master spreadsheet.
4. To wipe accumulated cache and start fresh, click **🗑 Clear All**.

---

## 📊 Extracted Data Points (28 Columns)

Every creator record is populated with the following structured data fields:

1. `Name`
2. `Followers` (Normalized count)
3. `Rating`
4. `Price`
5. `Location` (City, State, Country)
6. `Platforms` (All active platforms detected)
7. `Instagram Followers`
8. `TikTok Followers`
9. `YouTube Subscribers`
10. `Twitter/X Followers`
11. `Category / Niche`
12. `Badges` (Top Creator, UGC, Verified, etc.)
13. `Profile URL` (Direct Collabstr URL)
14. `Instagram URL`
15. `Instagram Username`
16. `TikTok URL`
17. `TikTok Username`
18. `YouTube URL`
19. `YouTube Username`
20. `Twitter/X URL`
21. `Linktree / Bio Link` (Linktree, Beacons, Stan.store, etc.)
22. `Website` (Independent business site)
23. `Amazon Storefront`
24. `Email`
25. `Bio`
26. `Categories (Profile)`
27. `Languages`
28. `Other Social Links` (Pinterest, LinkedIn, Snapchat, Twitch)

---

## 🏢 About Apex Automation Team

We build custom integrations, web scrapers, browser extensions, and end-to-end AI automation workflows.

* **Website:** [https://apexautomationteam.com/](https://apexautomationteam.com/)
* **Support & Maintenance Inquiries:** contact@apexautomationteam.com
```[cite: 14, 21]

---

Is tarah aapki Collabstr repository ka description, code upload, multi-page persistent memory guide, contact email (`contact@apexautomationteam.com`), aur update notice bilkul complete ho gaya hai! Agla project kaunsa upload karna hai?
