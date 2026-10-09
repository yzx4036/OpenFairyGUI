import test from 'ava';
import { mergeRegionContent, REGION_BEGIN, REGION_END } from '../src/merge.js';

const ATTRIBUTES_BEGIN = REGION_BEGIN('MapPanel:attributes');
const ATTRIBUTES_END = REGION_END('MapPanel:attributes');
const VIEW_BEGIN = REGION_BEGIN('MapPanel:view');
const VIEW_END = REGION_END('MapPanel:view');

test('replaces marked regions while keeping hand-written code', (t) => {
	const existing = `$preserved_mark$

using ET.Client.PkgBubbleShooter;

namespace ET.Client
{
	${ATTRIBUTES_BEGIN}
	[ComponentOf(typeof(FUIEntity))]
	[FUIPanel(PanelId.MapPanel, "Pkg_BubbleShooter", "MapPanel", typeof(FUI_MapPanel), FUILayer.Normal)]
	${ATTRIBUTES_END}
	public partial class MapPanel : Entity, IAwake
	{
	${VIEW_BEGIN}
		private FUI_MapPanel _view;

		public FUI_MapPanel View
		{
			get => _view ??= (FUI_MapPanel)GetParent<FUIEntity>()?.GComponent;
		}
	${VIEW_END}

		public BubbleShooterMapViewData ViewData;
	}
}`;

	const generated = `$preserved_mark$

using ET.Client.PkgBubbleShooter;

namespace ET.Client
{
	${ATTRIBUTES_BEGIN}
	[ComponentOf(typeof(FUIEntity))]
	[FUIPanel(PanelId.MapPanel, "Pkg_BubbleShooter", "MapPanel", typeof(FUI_MapPanel), FUILayer.Scene)]
	${ATTRIBUTES_END}
	public partial class MapPanel : Entity, IAwake
	{
	${VIEW_BEGIN}
		private FUI_MapPanel _view;

		public FUI_MapPanel View
		{
			get => _view ??= (FUI_MapPanel)GetParent<FUIEntity>()?.GComponent;
		}
	${VIEW_END}
	}
}`;

	const merged = mergeRegionContent(existing, generated, ['MapPanel:attributes', 'MapPanel:view']);
	t.truthy(merged, 'merge should succeed when markers exist');
	t.true(merged!.includes('FUILayer.Scene'), 'attributes region should be updated');
	t.true(merged!.includes('public BubbleShooterMapViewData ViewData;'), 'hand-written field must survive');
	t.false(merged!.includes('FUILayer.Normal'), 'old layer must be gone');
});

test('returns null when existing file has no markers (preserve fallback)', (t) => {
	const legacy = `// hand-written legacy entity, no markers
public partial class OldPanel : Entity, IAwake { }`;
	const generated = `// fresh generated content`;
	const merged = mergeRegionContent(legacy, generated, ['OldPanel:attributes']);
	t.is(merged, null);
});

test('inserts missing region when file has another marker (region added later)', (t) => {
	const newPanelBegin = REGION_BEGIN('NewPanel:attributes');
	const newPanelEnd = REGION_END('NewPanel:attributes');
	const existing = `public partial class NewPanel : Entity, IAwake
{
	public int HandWritten;
}`;
	const generated = `namespace ET.Client
{
	${newPanelBegin}
	[ComponentOf(typeof(FUIEntity))]
	[FUIPanel(PanelId.NewPanel, "Pkg", "NewPanel", typeof(FUI_NewPanel), FUILayer.Normal)]
	${newPanelEnd}
	public partial class NewPanel : Entity, IAwake
	{
	}
}`;
	const merged = mergeRegionContent(existing, generated, ['NewPanel:attributes']);
	t.truthy(merged);
	t.true(merged!.includes(newPanelBegin), 'attributes region should be inserted');
	t.true(merged!.includes('public int HandWritten;'), 'hand-written member stays');
});