$preserved_mark$

using $binding_namespace$;

namespace $base_namespace$
{
	[ComponentOf(typeof(FUIEntity))]
	[FUIPanel(PanelId.$entity_name$, "$package_name$", "$component_name$", typeof($binding_class$), FUILayer.$layer$)]
	public partial class $entity_name$ : Entity, IAwake
	{
		public $binding_class$ View;
	}
}
