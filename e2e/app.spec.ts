import { expect, test, type Page } from '@playwright/test';

// 47 Dana Place Road: a parcel from public/data/parcels.geojson with a stable label point.
const DANA_PLACE = { lng: -71.234343, lat: 44.196699, address: '47 DANA PLACE ROAD' };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png` });
}

/** Waits until the dev map handle exists and has finished rendering. */
async function mapIdle(page: Page) {
  await page.waitForFunction(() => window.__parcelMap?.loaded() && window.__parcelMap.getLayer('parcels-fill'));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const map = window.__parcelMap!;
        if (!map.isMoving() && map.areTilesLoaded()) resolve();
        else map.once('idle', () => resolve());
      }),
  );
}

test('renders Jackson parcels', async ({ page }) => {
  await page.goto('/');
  await mapIdle(page);
  const rendered = await page.evaluate(() => window.__parcelMap!.queryRenderedFeatures({ layers: ['parcels-fill'] }).length);
  expect(rendered).toBeGreaterThan(500);
  await shot(page, 'overview');
});

test('tapping a parcel marker opens its details', async ({ page }) => {
  await page.goto('/');
  await mapIdle(page);
  await page.evaluate(({ lng, lat }) => window.__parcelMap!.jumpTo({ center: [lng, lat], zoom: 17 }), DANA_PLACE);
  await mapIdle(page);
  const point = await page.evaluate(({ lng, lat }) => window.__parcelMap!.project([lng, lat]), DANA_PLACE);
  const box = (await page.locator('.map canvas').boundingBox())!;
  await page.mouse.click(box.x + point.x, box.y + point.y);
  await expect(page.getByRole('heading', { name: DANA_PLACE.address })).toBeVisible();
  await expect(page.getByText('R08-00010-000000', { exact: true })).toBeVisible();
  await shot(page, 'parcel-panel');
});

test('GPS follows the user and shows the parcel underneath', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: DANA_PLACE.lng, latitude: DANA_PLACE.lat, accuracy: 5 });
  await page.goto('/');
  await mapIdle(page);
  await page.getByRole('button', { name: 'Start GPS' }).click();
  await expect(page.getByText(`You're on: ${DANA_PLACE.address}`)).toBeVisible();
  await expect(page.locator('.me-marker')).toBeVisible();
  // Follow mode should move the camera onto the user.
  await expect
    .poll(() => page.evaluate(() => window.__parcelMap!.getCenter().toArray()))
    .toEqual([expect.closeTo(DANA_PLACE.lng, 3), expect.closeTo(DANA_PLACE.lat, 3)]);
  await mapIdle(page);
  await shot(page, 'gps');
});

test('owner index filters town-owned holdings', async ({ page }) => {
  await page.goto('/');
  await mapIdle(page);
  await page.getByRole('button', { name: 'Owners' }).click();
  await page.getByRole('button', { name: 'Town-owned' }).click();
  await expect(page.getByTestId('owners-summary')).toContainText('1 owner · 42 holdings');
  await page.getByRole('button', { name: /JACKSON, TOWN OF/ }).click();
  await expect(page.locator('.holdings tbody tr')).toHaveCount(42);
  await shot(page, 'owners-town');
});
