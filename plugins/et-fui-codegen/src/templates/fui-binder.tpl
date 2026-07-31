$generated_mark$

using FairyGUI;

namespace $base_namespace$
{
	public static class FUIBinder
	{
		public static void BindAll()
		{
			UIObjectFactory.Clear();
//$for component in components$
			UIObjectFactory.SetPackageItemExtension($component.full_class$.URL, typeof($component.full_class$));
//$endfor$
		}
	}
}
