$generated_mark$

namespace $base_namespace$
{
	public static partial class PanelId
	{
//$for panel in panels$
		public const int $panel.name$ = $panel.id$;
//$endfor$
	}
}
