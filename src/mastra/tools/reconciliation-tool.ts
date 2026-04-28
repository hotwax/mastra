import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { compareData } from '../scripts/reconciliation-logic-helper.js';

export const reconciliationTool = createTool({
    id: 'reconciliation-tool',
    description: 'Reconciles data received from Shopify and Moqui via a REST API. Returns JSON data and status messages.',
    inputSchema: z.object({
        orderIdList: z.string().describe('Comma-separated list of order IDs or a single order ID to reconcile'),
        productCategoryId: z.string().describe('The product category ID for the reconciliation scenario (e.g., RECL_ORD_STS)'),
    }),
    outputSchema: z.object({
        reconciliationList: z.array(z.any()).describe('The list of reconciliation results'),
        messages: z.string().optional().describe('Informational or error messages from the reconciliation process'),
    }),
    execute: async (input) => {
        const { orderIdList, productCategoryId } = input as { orderIdList: string; productCategoryId: string };

        // Use environment variable for the instance URL, fallback to localhost if not set
        const instanceUrl = process.env.INSTANCE_URL || 'http://localhost:8080';
        const url = `${instanceUrl}/rest/s1/sob-test/reconciliation/execute`;

        console.log(`Calling reconciliation API: ${url}`);
        console.log(`Payload: `, { orderIdList, productCategoryId });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    orderIdList,
                    productCategoryId,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API returned ${response.status}: ${errorText}`);
            }

            const data = await response.json() as any;
            console.log(`[RECONCILIATION] Processing ${data.reconciliationList?.length || 0} items`);
            const reconciliationList = (data.reconciliationList || []).map((item: any) => {
                const diff = compareData(item.scenario, item.sqlData, item.gqlData);
                return {
                    ...item,
                    dataDiff: diff
                };
            });

            const result = {
                reconciliationList,
                messages: data.messages || '',
            };

            // Return the processed result directly
            return result;
        } catch (error) {
            console.error('Error during reconciliation API call:', error);
            return {
                reconciliationList: [],
                messages: error instanceof Error ? error.message : String(error),
            };
        }
    },
});
