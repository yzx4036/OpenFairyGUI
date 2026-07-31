$generated_mark$

using FairyGUI;
using FairyGUI.Utils;

namespace $namespace$
{
	[FUIGComponent("$package_name$", "$component_name$")]
	[EnableClass]
	public partial class $class_name$ : $base_type$
	{
$fields$
		public const string URL = "$url$";

		public static $class_name$ CreateInstance()
		{
			return ($class_name$)UIPackage.CreateObject("$package_name$", "$component_name$");
		}

		public override void ConstructFromXML(XML xml)
		{
			base.ConstructFromXML(xml);
$assignments$
		}
	}
}
