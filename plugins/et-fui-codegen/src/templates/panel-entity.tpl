$preserved_mark$

using $binding_namespace$;

namespace $base_namespace$
{
// ===== GENERATED:et-fui-codegen:$entity_name$:attributes:BEGIN =====
	[ComponentOf(typeof(FUIEntity))]
	[FUIPanel(PanelId.$entity_name$, "$package_name$", "$component_name$", typeof($binding_class$), FUILayer.$layer$)]
// ===== GENERATED:et-fui-codegen:$entity_name$:attributes:END =====
	public partial class $entity_name$ : Entity, IAwake
	{
// ===== GENERATED:et-fui-codegen:$entity_name$:view:BEGIN =====
		private $binding_class$ _view;

		public $binding_class$ View
		{
			get => _view ??= ($binding_class$)GetParent<FUIEntity>()?.GComponent;
		}
// ===== GENERATED:et-fui-codegen:$entity_name$:view:END =====
	}
}