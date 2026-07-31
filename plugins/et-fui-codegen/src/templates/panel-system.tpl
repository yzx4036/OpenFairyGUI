$preserved_mark$

namespace $base_namespace$
{
	[FriendOf(typeof($entity_name$))]
	public static partial class $entity_name$System
	{
		public static void Awake(this $entity_name$ self) { }

		public static void RegisterUIEvent(this $entity_name$ self)
		{
			// Framework-injected UI event bindings belong here.
		}

		public static void OnShow(this $entity_name$ self, ArgsDict contextData = null) { }

		public static void OnHide(this $entity_name$ self) { }

		public static void BeforeUnload(this $entity_name$ self) { }
	}
}
