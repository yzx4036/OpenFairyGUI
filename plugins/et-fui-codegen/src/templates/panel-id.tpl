$generated_mark$

namespace $base_namespace$
{
	public static partial class PanelId
	{
		public const int Invalid = 0;
//$for panel in panels$
		public const int $panel.name$ = $panel.id$;
//$endfor$
	}
}
