$preserved_mark$

namespace $base_namespace$
{
	[FriendOf(typeof($entity_name$))]
	public static partial class $entity_name$System
	{
		public static void Awake(this $entity_name$ self) { }

		public static void RegisterUIEvent(this $entity_name$ self)
		{
			foreach (var child in self.Children.Values)
			{
				FUIEventComponent.Instance.InvokePanelLifecycle(child, "RegisterUIEvent");
			}
		}

		public static void OnShow(this $entity_name$ self, ArgsDict contextData = null)
		{
			foreach (var child in self.Children.Values)
			{
				FUIEventComponent.Instance.InvokePanelLifecycle(child, "OnShow", contextData);
			}
		}

		public static void OnHide(this $entity_name$ self)
		{
			foreach (var child in self.Children.Values)
			{
				FUIEventComponent.Instance.InvokePanelLifecycle(child, "OnHide");
			}
		}

		public static void BeforeUnload(this $entity_name$ self)
		{
			foreach (var child in self.Children.Values)
			{
				FUIEventComponent.Instance.InvokePanelLifecycle(child, "BeforeUnload");
			}
		}
	}
}
