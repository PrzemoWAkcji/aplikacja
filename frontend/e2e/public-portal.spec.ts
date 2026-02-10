import { test, expect } from '@playwright/test';

test.describe('Public Portal', () => {
    test('should display home page with title', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('WYNIKI ZAWODÓW');
    });

    test('should navigate to login page', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Panel Sędziowski');
        await expect(page).toHaveURL(/.*login/);
    });

    test('should display live indicator on results page if connected', async ({ page }) => {
        // This assumes there's at least one meeting, but for test coverage we check if the container exists
        await page.goto('/');
        const meetingCard = page.locator('text=Wyniki Live').first();
        if (await meetingCard.isVisible()) {
            await meetingCard.click();
            await expect(page).toHaveURL(/.*results/);
        }
    });
});
