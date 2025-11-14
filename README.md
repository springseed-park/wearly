<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1YUUEpkPxz4lTadCOgPjDfqApIXvTIbMf

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `OPENAI_API_KEY` in [.env.local](.env.local) to your OpenAI API key
   - Get your API key from: https://platform.openai.com/api-keys
3. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

To deploy this app to GitHub Pages:

1. **Enable GitHub Pages in your repository:**
   - Go to Settings → Pages
   - Source: GitHub Actions

2. **Add OpenAI API Key as a Secret:**
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

3. **Push to main branch:**
   - The GitHub Actions workflow will automatically build and deploy
   - Your app will be available at: `https://[username].github.io/wearly/`

**Note:** Since API keys are handled client-side, consider using a backend proxy for production deployments to keep your API key secure.
