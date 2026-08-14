import { fnv1a31 } from '@openfairygui/codegen';

/** Returns a stable, positive 31-bit panel id from FairyGUI package and component ids. */
export function hashPanelId(packageId: string, componentId: string): number {
	return fnv1a31(`${packageId}:${componentId}`);
}
